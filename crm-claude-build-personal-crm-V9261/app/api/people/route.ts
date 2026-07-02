import { NextResponse } from "next/server";
import { requireUserOrApiKey } from "@/lib/supabase/server";
import { composeFullName } from "@/lib/names";
import { embed, buildEmbeddingInput } from "@/lib/ai/openai";
import { emailLooksMismatched } from "@/lib/emails";

export const maxDuration = 30;

interface Body {
  firstName?: string;
  lastName?: string;
  email?: string;
  linkedin?: string;
  summary?: string;
  permanentNotes?: string;
  confirmMismatch?: boolean;
}

// Create a contact directly. No interaction recorded — this is the "I just want
// to add someone" surface, separate from Quick Add which logs an interaction.
//
// If the user provides a summary, we generate an embedding immediately
// (manual-summary path per PRD §Relationship Summary Editing). Otherwise the
// person starts in the "no summary yet" state.
export async function POST(req: Request) {
  const auth = await requireUserOrApiKey(req);
  if (auth instanceof Response) return auth;
  const { supabase, ownerId } = auth;
  const body = (await req.json()) as Body;

  const first = body.firstName?.trim() ?? "";
  const last = body.lastName?.trim() ?? "";
  if (!first) return NextResponse.json({ error: "First name is required" }, { status: 400 });

  const email = body.email?.trim().toLowerCase() || null;
  const linkedin = body.linkedin?.trim() || null;
  if (!email && !linkedin) {
    return NextResponse.json({ error: "Provide an email or a LinkedIn URL" }, { status: 400 });
  }

  const fullName = composeFullName(first, last);
  const summary = body.summary?.trim().slice(0, 1000) || null;
  const notes = body.permanentNotes?.trim() || null;

  // Email/name mismatch guard — catches the "typed my own email by mistake" case.
  // Requires explicit confirmMismatch to override.
  if (email && !body.confirmMismatch && emailLooksMismatched(email, first, last || null)) {
    return NextResponse.json({
      warning: "email_name_mismatch",
      message: `"${email}" doesn't look like it belongs to ${fullName}. Save anyway?`,
    }, { status: 409 });
  }

  // Dedupe on linkedin / primary_email — friendlier than surfacing an opaque DB unique error.
  if (linkedin) {
    const { data: dup } = await supabase.from("people").select("id").eq("linkedin_url", linkedin).maybeSingle();
    if (dup) return NextResponse.json({ error: "Someone with that LinkedIn already exists", existingId: dup.id }, { status: 409 });
  }
  if (email) {
    const { data: dup } = await supabase.from("people").select("id").eq("primary_email", email).maybeSingle();
    if (dup) return NextResponse.json({ error: "Someone with that email already exists", existingId: dup.id }, { status: 409 });
  }

  // Compute embedding if there's any embeddable text (summary or notes).
  const embeddingInput = buildEmbeddingInput(summary, notes);
  let embedding: number[] | null = null;
  if (embeddingInput) {
    try {
      embedding = await embed(embeddingInput);
    } catch (e) {
      // Don't block creation on an embedding failure — record it as a warning.
      console.error("embedding failed on contact create:", e);
    }
  }

  const { data, error } = await supabase
    .from("people")
    .insert({
      owner_id: ownerId,
      first_name: first,
      last_name: last || null,
      full_name: fullName,
      primary_email: email,
      linkedin_url: linkedin,
      relationship_summary: summary,
      permanent_notes: notes,
      semantic_embedding: embedding,
    })
    .select("id")
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "create failed" }, { status: 500 });

  return NextResponse.json({ ok: true, personId: data.id });
}
