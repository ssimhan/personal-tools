import { NextResponse } from "next/server";
import { requireUserOrApiKey } from "@/lib/supabase/server";
import { regenerateEmbeddingForPerson } from "@/lib/pipeline";
import { scoreNotesForAsk } from "@/lib/ai/anthropic";

export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUserOrApiKey(req);
  if (auth instanceof Response) return auth;
  const { supabase } = auth;
  const { notes } = await req.json();
  if (typeof notes !== "string") return NextResponse.json({ error: "notes must be string" }, { status: 400 });

  const { error } = await supabase.from("people").update({ permanent_notes: notes }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Permanent notes are part of the embedding input — regen embedding (not summary).
  try {
    await regenerateEmbeddingForPerson(supabase, id);
  } catch (e) {
    // Don't fail the save if embedding regen errors — note is still authoritative.
    console.error("embedding regen after note edit failed:", e);
  }

  // Re-score the "is there an open ask?" signal the Feed uses for ranking.
  // Failures don't block the save — the score just doesn't update this round.
  try {
    const score = await scoreNotesForAsk(notes);
    await supabase.from("people").update({ notes_priority_score: score }).eq("id", id);
  } catch (e) {
    console.error("notes priority scoring failed:", e);
  }

  return NextResponse.json({ ok: true });
}
