import type { SupabaseClient } from "@supabase/supabase-js";
import { regenerateSummary } from "@/lib/ai/anthropic";
import { embed, buildEmbeddingInput } from "@/lib/ai/openai";

// Interaction Processing Pipeline per PRD §Interaction Processing Pipeline.
//
// Step 0 — screenshot extraction (handled at call site before this runs)
// Step 1 — resolve identity (handled at call site)
// Step 2 — store append-only interaction
// Step 3 — broadcast_sent SHORT-CIRCUIT: skip regeneration entirely
// Step 4 — fetch summary, permanent notes
// Step 5 — regenerate summary (current summary + permanent notes + new interaction ONLY)
// Step 6 — store prior snapshot + new summary + regenerated embedding

export interface LogInteractionInput {
  personId: string;
  type: "manual_note" | "pasted_email" | "screenshot" | "imported_contact" | "broadcast_sent";
  rawContent: string;
  ownerId: string;
  source?: string | null;
  matchedIdentityConfidence?: number | null;
  extractionConfidence?: number | null;
}

export interface LogInteractionResult {
  interactionId: string;
  regenerated: boolean;
  newSummary?: string;
}

export async function logInteractionAndProcess(
  supabase: SupabaseClient,
  input: LogInteractionInput,
): Promise<LogInteractionResult> {
  // Step 2 — append-only insert
  const { data: ix, error: ixErr } = await supabase
    .from("interactions")
    .insert({
      owner_id: input.ownerId,
      person_id: input.personId,
      interaction_type: input.type,
      raw_content: input.rawContent,
      source: input.source ?? null,
      matched_identity_confidence: input.matchedIdentityConfidence ?? null,
      extraction_confidence: input.extractionConfidence ?? null,
    })
    .select("id, created_at")
    .single();
  if (ixErr || !ix) throw new Error(`Failed to insert interaction: ${ixErr?.message}`);

  // Step 3 — broadcast_sent short-circuit
  if (input.type === "broadcast_sent") {
    // Record when we last broadcast to this person (sortable on the audience builder).
    await supabase.from("people").update({ last_broadcast_at: ix.created_at }).eq("id", input.personId);
    return { interactionId: ix.id, regenerated: false };
  }

  // imported_contact also does not regenerate — bulk imports add records without
  // generating summaries/embeddings (per PRD §Import).
  if (input.type === "imported_contact") {
    return { interactionId: ix.id, regenerated: false };
  }

  // Step 4 — fetch person state
  const { data: person, error: pErr } = await supabase
    .from("people")
    .select("id, full_name, relationship_summary, permanent_notes")
    .eq("id", input.personId)
    .single();
  if (pErr || !person) throw new Error(`Person not found: ${pErr?.message}`);

  // Step 5 — regenerate summary (scoped input: current summary + permanent notes + this new interaction)
  const newSummary = await regenerateSummary({
    currentSummary: person.relationship_summary,
    permanentNotes: person.permanent_notes,
    newInteractions: [
      {
        type: input.type,
        content: input.rawContent,
        createdAt: ix.created_at,
      },
    ],
  });

  // Step 6 — regenerate embedding from (new summary + permanent notes)
  const embeddingInput = buildEmbeddingInput(newSummary, person.permanent_notes);
  const embedding = embeddingInput ? await embed(embeddingInput) : null;

  const { error: updErr } = await supabase
    .from("people")
    .update({
      relationship_summary_previous: person.relationship_summary, // single prior snapshot
      relationship_summary: newSummary,
      semantic_embedding: embedding,
    })
    .eq("id", input.personId);
  if (updErr) throw new Error(`Failed to update person: ${updErr.message}`);

  return { interactionId: ix.id, regenerated: true, newSummary };
}

// Called when the user edits permanent notes — per PRD §Permanent Notes,
// embeddings regenerate on permanent-note edits because notes are part of the
// embedding input. Summary is NOT regenerated (notes are authoritative and
// already considered in the next summary regen).
export async function regenerateEmbeddingForPerson(supabase: SupabaseClient, personId: string): Promise<void> {
  const { data: person } = await supabase
    .from("people")
    .select("relationship_summary, permanent_notes")
    .eq("id", personId)
    .single();
  if (!person) return;
  const input = buildEmbeddingInput(person.relationship_summary, person.permanent_notes);
  const embedding = input ? await embed(input) : null;
  await supabase.from("people").update({ semantic_embedding: embedding }).eq("id", personId);
}

// Called when the user manually edits the relationship summary OR reverts to
// the prior snapshot. Per PRD §Relationship Summary Editing — embedding
// regenerates from the edited summary.
export async function applyManualSummaryEdit(
  supabase: SupabaseClient,
  personId: string,
  newSummary: string,
): Promise<void> {
  const { data: person } = await supabase
    .from("people")
    .select("relationship_summary, permanent_notes")
    .eq("id", personId)
    .single();
  if (!person) return;
  const trimmed = newSummary.slice(0, 1000);
  const input = buildEmbeddingInput(trimmed, person.permanent_notes);
  const embedding = input ? await embed(input) : null;
  await supabase
    .from("people")
    .update({
      relationship_summary_previous: person.relationship_summary,
      relationship_summary: trimmed,
      semantic_embedding: embedding,
    })
    .eq("id", personId);
}

export async function revertSummary(supabase: SupabaseClient, personId: string): Promise<boolean> {
  const { data: person } = await supabase
    .from("people")
    .select("relationship_summary, relationship_summary_previous, permanent_notes")
    .eq("id", personId)
    .single();
  if (!person || !person.relationship_summary_previous) return false;

  const reverted = person.relationship_summary_previous;
  const input = buildEmbeddingInput(reverted, person.permanent_notes);
  const embedding = input ? await embed(input) : null;

  // After revert, the snapshot is cleared — there is only ever ONE prior version.
  await supabase
    .from("people")
    .update({
      relationship_summary: reverted,
      relationship_summary_previous: person.relationship_summary, // the version we just left
      semantic_embedding: embedding,
    })
    .eq("id", personId);
  return true;
}
