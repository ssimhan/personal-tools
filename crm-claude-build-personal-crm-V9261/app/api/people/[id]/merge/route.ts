import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { embed, buildEmbeddingInput } from "@/lib/ai/openai";

export const maxDuration = 60;

// Merge two people. The :id in the path is the KEEP target; the body specifies
// which other person to drop. All interactions, tags, and useful field values
// flow into the keep target; the drop target is hard-deleted.
//
// Field merge rules:
//   - permanent_notes  → concat if both have content
//   - linkedin_url, primary_email, phone_number → keep wins, else use drop's
//   - secondary_emails → union (and include drop's primary_email if it differs)
//   - relationship_summary → keep wins; if keep has none and drop has one, use drop's
//   - relationship_summary_previous → drop's old summary preserved as a snapshot
//     if the keep didn't already have one
//   - first_name / last_name / full_name → keep wins
// Embedding is regenerated from (final summary + final notes).

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: keepId } = await params;
  const { supabase } = await requireUser();
  const { otherId } = (await req.json()) as { otherId?: string };

  if (!otherId || otherId === keepId) {
    return NextResponse.json({ error: "otherId required and must differ from path id" }, { status: 400 });
  }

  const { data: people, error: fetchErr } = await supabase
    .from("people")
    .select("*")
    .in("id", [keepId, otherId]);
  if (fetchErr || !people || people.length !== 2) {
    return NextResponse.json({ error: fetchErr?.message ?? "people not found" }, { status: 404 });
  }
  const keep = people.find((p) => p.id === keepId)!;
  const drop = people.find((p) => p.id === otherId)!;

  // Merge text fields
  const mergedNotes = [keep.permanent_notes, drop.permanent_notes].filter((s) => s && s.trim()).join("\n\n") || null;
  const mergedSummary = keep.relationship_summary?.trim() ? keep.relationship_summary : drop.relationship_summary;
  const mergedPrevSnapshot =
    keep.relationship_summary_previous ?? drop.relationship_summary ?? drop.relationship_summary_previous ?? null;

  // Union secondary emails, include drop's primary if it differs from keep's
  const secondarySet = new Set<string>([
    ...(keep.secondary_emails ?? []),
    ...(drop.secondary_emails ?? []),
  ]);
  if (drop.primary_email && drop.primary_email.toLowerCase() !== keep.primary_email?.toLowerCase()) {
    secondarySet.add(drop.primary_email);
  }
  if (keep.primary_email && keep.primary_email.toLowerCase() !== drop.primary_email?.toLowerCase() && drop.primary_email) {
    // keep's primary stays as primary; drop's becomes secondary (already added above)
  }

  const update = {
    permanent_notes: mergedNotes,
    relationship_summary: mergedSummary,
    relationship_summary_previous: mergedPrevSnapshot,
    linkedin_url: keep.linkedin_url ?? drop.linkedin_url,
    primary_email: keep.primary_email ?? drop.primary_email,
    phone_number: keep.phone_number ?? drop.phone_number,
    secondary_emails: Array.from(secondarySet),
    preferred_channel: keep.preferred_channel ?? drop.preferred_channel,
    slack_channel: keep.slack_channel ?? drop.slack_channel,
  };

  // Re-point all interactions from drop → keep (preserves history per PRD append-only rule)
  const { error: ixErr } = await supabase
    .from("interactions")
    .update({ person_id: keepId })
    .eq("person_id", otherId);
  if (ixErr) return NextResponse.json({ error: `interaction move failed: ${ixErr.message}` }, { status: 500 });

  // Move tags from drop → keep, ignoring conflicts (keep already has the same tag)
  const { data: dropTags } = await supabase.from("people_tags").select("tag_id").eq("person_id", otherId);
  if (dropTags && dropTags.length) {
    const links = dropTags.map((t) => ({ person_id: keepId, tag_id: t.tag_id }));
    await supabase.from("people_tags").upsert(links, { onConflict: "person_id,tag_id" });
  }

  // Apply merged fields to keep
  const { error: updErr } = await supabase.from("people").update(update).eq("id", keepId);
  if (updErr) return NextResponse.json({ error: `update keep failed: ${updErr.message}` }, { status: 500 });

  // Delete the drop person — interactions are already moved, tag rows cascade.
  const { error: delErr } = await supabase.from("people").delete().eq("id", otherId);
  if (delErr) return NextResponse.json({ error: `delete drop failed: ${delErr.message}` }, { status: 500 });

  // Regenerate embedding from merged content
  const embInput = buildEmbeddingInput(update.relationship_summary, update.permanent_notes);
  if (embInput) {
    try {
      const vec = await embed(embInput);
      await supabase.from("people").update({ semantic_embedding: vec }).eq("id", keepId);
    } catch (e) {
      console.error("embedding regen after merge failed:", e);
    }
  }

  return NextResponse.json({ ok: true, keepId });
}
