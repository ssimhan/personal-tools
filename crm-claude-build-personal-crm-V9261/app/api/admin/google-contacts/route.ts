import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";

export const maxDuration = 60;

interface GoogleRow {
  fullName: string; // "First Last" — empty string if neither provided
  email: string;    // lowercased; "" if absent
  phone: string;    // first non-empty phone; "" if absent
}

interface Body { rows: GoogleRow[] }

// One-shot phone backfill from Google Contacts. For each Google row:
//   1. Find CRM people matching by exact email (case-insensitive) OR exact full
//      name (case-insensitive).
//   2. If exactly ONE unique match AND that person has no phone yet, fill it
//      with the Google phone.
//   3. Anything else (no match, ambiguous match, phone already on file) is
//      skipped. Phones are NEVER overwritten.
export async function POST(req: Request) {
  const { supabase, ownerId } = await requireUser();
  const { rows } = (await req.json()) as Body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "no rows" }, { status: 400 });
  }

  // Pull every person once — single-user CRM, at most low thousands.
  const { data: people } = await supabase
    .from("people")
    .select("id, full_name, primary_email, secondary_emails, phone_number")
    .eq("owner_id", ownerId);

  const byEmail = new Map<string, string>(); // lower(email) -> personId
  const byName = new Map<string, string[]>(); // lower(full_name) -> personId[]
  for (const p of people ?? []) {
    const id = p.id as string;
    if (p.primary_email) byEmail.set(String(p.primary_email).trim().toLowerCase(), id);
    for (const se of (p.secondary_emails as string[] | null) ?? []) {
      if (se) byEmail.set(String(se).trim().toLowerCase(), id);
    }
    const name = String(p.full_name ?? "").trim().toLowerCase();
    if (name) {
      const arr = byName.get(name) ?? [];
      arr.push(id);
      byName.set(name, arr);
    }
  }
  const phoneById = new Map<string, string | null>(
    (people ?? []).map((p) => [p.id as string, (p.phone_number as string) ?? null]),
  );

  let updated = 0;
  let alreadyHadPhone = 0;
  let noMatch = 0;
  let ambiguous = 0;
  let noPhoneInRow = 0;
  const examples: { name: string; phone: string }[] = [];

  for (const row of rows) {
    if (!row.phone || !row.phone.trim()) { noPhoneInRow++; continue; }

    const emailKey = row.email?.trim().toLowerCase();
    const nameKey = row.fullName?.trim().toLowerCase();
    const candidates = new Set<string>();
    if (emailKey && byEmail.has(emailKey)) candidates.add(byEmail.get(emailKey)!);
    if (nameKey && byName.has(nameKey)) byName.get(nameKey)!.forEach((id) => candidates.add(id));

    if (candidates.size === 0) { noMatch++; continue; }
    if (candidates.size > 1) { ambiguous++; continue; }
    const personId = [...candidates][0];
    if (phoneById.get(personId)) { alreadyHadPhone++; continue; }

    const phone = row.phone.trim();
    const { error: updErr } = await supabase
      .from("people")
      .update({ phone_number: phone })
      .eq("id", personId);
    if (updErr) continue;
    phoneById.set(personId, phone); // prevent a second row from re-writing
    updated++;
    if (examples.length < 10) examples.push({ name: row.fullName || row.email, phone });
  }

  return NextResponse.json({
    inputRows: rows.length,
    updated,
    alreadyHadPhone,
    noMatch,
    ambiguous,
    noPhoneInRow,
    examples,
  });
}
