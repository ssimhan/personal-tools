import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { composeFullName, splitFullName } from "@/lib/names";
import { normalizeLinkedIn } from "@/lib/identity";

export const maxDuration = 60;

interface Row {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  linkedin_url?: string | null;
  primary_email?: string | null;
  email?: string;
  phone_number?: string | null;
  tags?: string; // per-row, comma-separated (e.g. "Whispered, GTMCouncil")
  frequency?: string; // broadcast cadence in months: 2/4/6/8 (blank = none)
}

interface PersonFields {
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  linkedin_url: string | null;
  primary_email: string | null;
  phone_number: string | null;
  broadcast_months: number | null;
}

// Fields we'll back-fill onto an existing/queued person when they're currently
// blank (we never overwrite a value the contact already has). full_name is
// excluded — it's required, so it always exists, and it's their display name.
const FILLABLE = ["linkedin_url", "primary_email", "phone_number", "first_name", "last_name"] as const;

// Lenient match key for LinkedIn: normalized, with protocol + www stripped, so
// http/https and www/non-www variants collapse to the same person.
function linkedinKey(url: string | null | undefined): string {
  if (!url) return "";
  return normalizeLinkedIn(url).replace(/^https?:\/\//, "").replace(/^www\./, "");
}

const splitTags = (s: string | undefined): string[] =>
  (s ?? "").split(",").map((t) => t.trim()).filter(Boolean);

// Parse a Frequency cell to a broadcast cadence. Only 2/4/6/8 are valid; any
// other value (or blank) → null ("None").
function parseFrequency(s: string | undefined): number | null {
  const n = parseInt(String(s ?? "").trim(), 10);
  return [2, 4, 6, 8].includes(n) ? n : null;
}

// Bulk import — per PRD §Import: creates records, attaches tags, no LLM calls.
// On a match against an existing contact (by normalized LinkedIn OR primary
// email), the row ENRICHES that contact instead of being skipped: missing tags
// are added (never removed) and any blank fields are filled.
//
// Tags are NEVER created from import — only tags already defined in Admin are
// attached. Tag names from the CSV that don't match an existing tag are ignored.
export async function POST(req: Request) {
  const { supabase, ownerId } = await requireUser();
  const { rows } = (await req.json()) as { rows: Row[] };

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "no rows" }, { status: 400 });
  }

  // Existing contacts, indexed for matching + blank detection.
  const { data: existing } = await supabase
    .from("people")
    .select("id, full_name, first_name, last_name, linkedin_url, primary_email, phone_number, broadcast_months");
  const existingByLinkedin = new Map<string, NonNullable<typeof existing>[number]>();
  const existingByEmail = new Map<string, NonNullable<typeof existing>[number]>();
  for (const p of existing ?? []) {
    const lk = linkedinKey(p.linkedin_url);
    if (lk) existingByLinkedin.set(lk, p);
    const em = p.primary_email?.toLowerCase();
    if (em) existingByEmail.set(em, p);
  }

  // Case-insensitive name→id map of the owner's existing tags. Import only ever
  // attaches these; unknown tag names are dropped (never created).
  const { data: ownerTags } = await supabase.from("tags").select("id, name").eq("owner_id", ownerId);
  const tagIdByLowerName = new Map<string, string>();
  for (const t of ownerTags ?? []) tagIdByLowerName.set(t.name.toLowerCase(), t.id);
  const tagIdsFor = (names: Iterable<string>): string[] => {
    const ids: string[] = [];
    for (const n of names) {
      const id = tagIdByLowerName.get(n.toLowerCase());
      if (id) ids.push(id);
    }
    return ids;
  };

  // Accumulators.
  const enrichById = new Map<string, { tags: Set<string>; fills: Record<string, string | number> }>();
  const newRows: { fields: PersonFields; tags: Set<string> }[] = [];
  const newByLinkedin = new Map<string, number>();
  const newByEmail = new Map<string, number>();
  const newByName = new Map<string, number>();
  // Every tag name seen in the file, keyed by lowercase → original casing, so we
  // can report which ones matched no existing tag (and were therefore ignored).
  const seenTags = new Map<string, string>();
  let skipped = 0;

  for (const r of rows) {
    let first = r.first_name?.trim() ?? "";
    let last = r.last_name?.trim() ?? "";
    let full = r.full_name?.trim() ?? "";
    if (first || last) full = composeFullName(first, last);
    else if (full) { const parts = splitFullName(full); first = parts.first; last = parts.last ?? ""; }
    if (!full) { skipped++; continue; }

    const linkedinNorm = r.linkedin_url?.trim() ? normalizeLinkedIn(r.linkedin_url) : null;
    const lk = linkedinKey(linkedinNorm);
    const email = (r.primary_email ?? r.email)?.trim().toLowerCase() || null;
    const em = email ?? "";
    const rowTags = new Set<string>(splitTags(r.tags));
    rowTags.forEach((t) => { const k = t.toLowerCase(); if (!seenTags.has(k)) seenTags.set(k, t); });
    const fields: PersonFields = {
      full_name: full,
      first_name: first || null,
      last_name: last || null,
      linkedin_url: linkedinNorm,
      primary_email: email,
      phone_number: r.phone_number?.trim() || null,
      broadcast_months: parseFrequency(r.frequency),
    };

    // 1. Match an existing DB contact → enrich.
    const existingMatch = (lk && existingByLinkedin.get(lk)) || (em && existingByEmail.get(em)) || null;
    if (existingMatch) {
      const acc = enrichById.get(existingMatch.id) ?? { tags: new Set<string>(), fills: {} };
      rowTags.forEach((t) => acc.tags.add(t));
      for (const f of FILLABLE) {
        const existingVal = (existingMatch as Record<string, unknown>)[f];
        const rowVal = fields[f];
        if (!existingVal && !(f in acc.fills) && rowVal) acc.fills[f] = rowVal as string;
      }
      if (existingMatch.broadcast_months == null && acc.fills.broadcast_months == null && fields.broadcast_months != null) {
        acc.fills.broadcast_months = fields.broadcast_months;
      }
      enrichById.set(existingMatch.id, acc);
      continue;
    }

    // 2. Match an already-queued new row (within this file) → merge into it.
    let idx: number | undefined;
    if (lk) idx = newByLinkedin.get(lk);
    if (idx === undefined && em) idx = newByEmail.get(em);
    if (idx === undefined && !lk && !em) idx = newByName.get(full.toLowerCase());
    if (idx !== undefined) {
      const nr = newRows[idx];
      rowTags.forEach((t) => nr.tags.add(t));
      for (const f of FILLABLE) {
        if (!nr.fields[f] && fields[f]) nr.fields[f] = fields[f];
      }
      if (nr.fields.broadcast_months == null && fields.broadcast_months != null) {
        nr.fields.broadcast_months = fields.broadcast_months;
      }
      if (lk && !newByLinkedin.has(lk)) newByLinkedin.set(lk, idx);
      if (em && !newByEmail.has(em)) newByEmail.set(em, idx);
      continue;
    }

    // 3. Brand-new contact → queue for insert.
    const i = newRows.length;
    newRows.push({ fields, tags: rowTags });
    if (lk) newByLinkedin.set(lk, i);
    if (em) newByEmail.set(em, i);
    if (!lk && !em) newByName.set(full.toLowerCase(), i);
  }

  // Insert new contacts (single insert preserves order → correlate for tagging).
  let insertedCount = 0;
  if (newRows.length) {
    const { data: inserted, error: insErr } = await supabase
      .from("people")
      .insert(newRows.map((nr) => ({ ...nr.fields, owner_id: ownerId })))
      .select("id");
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    insertedCount = inserted?.length ?? 0;

    const links: { person_id: string; tag_id: string }[] = [];
    (inserted ?? []).forEach((p, i) => {
      for (const id of tagIdsFor(newRows[i].tags)) links.push({ person_id: p.id, tag_id: id });
    });
    if (links.length) await supabase.from("people_tags").upsert(links, { onConflict: "person_id,tag_id" });

    const ixs = (inserted ?? []).map((p) => ({
      owner_id: ownerId,
      person_id: p.id,
      interaction_type: "imported_contact" as const,
      raw_content: "Imported via CSV.",
    }));
    if (ixs.length) await supabase.from("interactions").insert(ixs);
  }

  // Apply enrichment to existing contacts (fill blanks + add missing tags; tags
  // are only ever added, never removed).
  let enrichedCount = 0;
  for (const [personId, acc] of enrichById) {
    if (Object.keys(acc.fills).length) {
      await supabase.from("people").update(acc.fills).eq("id", personId);
    }
    const links = tagIdsFor(acc.tags).map((id) => ({ person_id: personId, tag_id: id }));
    if (links.length) await supabase.from("people_tags").upsert(links, { onConflict: "person_id,tag_id" });
    enrichedCount++;
  }

  // Tag names from the file that matched no existing Admin tag (ignored).
  const unknownTags = [...seenTags.entries()]
    .filter(([lower]) => !tagIdByLowerName.has(lower))
    .map(([, original]) => original)
    .sort((a, b) => a.localeCompare(b));

  return NextResponse.json({ inserted: insertedCount, enriched: enrichedCount, skipped, unknownTags });
}
