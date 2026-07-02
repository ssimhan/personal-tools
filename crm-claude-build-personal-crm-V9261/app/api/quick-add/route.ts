import { NextResponse } from "next/server";
import { requireUserOrApiKey } from "@/lib/supabase/server";
import { extractTextFromImage } from "@/lib/ai/anthropic";
import { resolveIdentity, sniffIdentifiers } from "@/lib/identity";
import { logInteractionAndProcess } from "@/lib/pipeline";
import { splitFullName } from "@/lib/names";
import { emailLooksMismatched } from "@/lib/emails";

// Quick Add — Step 0 (OCR if screenshot), Step 1 (identity), Steps 2-6 (pipeline).
// Vercel function timeout: configured at the Vercel project level; OCR + summary +
// embedding fits comfortably in 60s for a single interaction.
export const maxDuration = 60;

const LOW_OCR_FLOOR = 0.5;

export async function POST(req: Request) {
  try {
    const auth = await requireUserOrApiKey(req);
    if (auth instanceof Response) return auth;
    const { supabase, ownerId } = auth;
    const form = await req.formData();

    const mode = String(form.get("mode") ?? "text") as "text" | "email" | "screenshot";
    const name = (form.get("name") as string | null)?.trim() || null;
    const linkedin = (form.get("linkedin") as string | null)?.trim() || null;
    const email = (form.get("email") as string | null)?.trim().toLowerCase() || null;
    // When set, skip identity resolution and log to this existing person.
    const forcePersonId = (form.get("force_person_id") as string | null)?.trim() || null;
    // When true, skip identity resolution and create a new person from the provided fields.
    const forceCreate = String(form.get("force_create") ?? "false") === "true";
    // When true, bypass the email/name mismatch guard.
    const confirmMismatch = String(form.get("confirm_mismatch") ?? "false") === "true";

    // Step 0 — screenshot OCR
    let rawContent: string;
    let extractionConfidence: number | null = null;
    if (mode === "screenshot") {
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No image uploaded" }, { status: 400 });
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const base64 = Buffer.from(bytes).toString("base64");
      const mt = file.type;
      if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mt)) {
        return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
      }
      const extracted = await extractTextFromImage({
        base64,
        mediaType: mt as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
      });
      extractionConfidence = extracted.confidence;

      // Low-confidence path: surface back to user instead of silently creating junk.
      if (!extracted.text.trim() || extracted.confidence < LOW_OCR_FLOOR) {
        return NextResponse.json({
          lowExtraction: true,
          extractedText: extracted.text,
          extractionConfidence: extracted.confidence,
        });
      }
      rawContent = extracted.text;
    } else {
      rawContent = String(form.get("content") ?? "").trim();
    }

    if (!rawContent) return NextResponse.json({ error: "Empty content" }, { status: 400 });

    let personId: string;
    let matchedConfidence: number | null = null;
    const sniffed = sniffIdentifiers(rawContent);

    if (forcePersonId) {
      // User picked an existing person to log to — skip resolution entirely.
      personId = forcePersonId;
    } else if (forceCreate) {
      // User explicitly chose "Create new" — same path as the no-match fallback below.
      if (!name) return NextResponse.json({ error: "Name required to create" }, { status: 400 });
      const { first, last } = splitFullName(name);
      const newEmail = email ?? sniffed.email ?? null;
      if (newEmail && !confirmMismatch && emailLooksMismatched(newEmail, first, last)) {
        return NextResponse.json({
          warning: "email_name_mismatch",
          message: `"${newEmail}" doesn't look like it belongs to ${name}. Save anyway?`,
        }, { status: 409 });
      }
      const { data: created, error: createErr } = await supabase
        .from("people")
        .insert({
          owner_id: ownerId,
          full_name: name,
          first_name: first || null,
          last_name: last,
          linkedin_url: linkedin ?? sniffed.linkedin ?? null,
          primary_email: newEmail,
        })
        .select("id")
        .single();
      if (createErr || !created) {
        return NextResponse.json({ error: createErr?.message ?? "Failed to create person" }, { status: 500 });
      }
      personId = created.id;
    } else {
      // Step 1 — identity resolution
      const resolved = await resolveIdentity(supabase, {
        linkedinUrl: linkedin ?? sniffed.linkedin ?? null,
        email: email ?? sniffed.email ?? null,
        fullName: name,
        snippet: rawContent,
      });

      if (resolved.kind === "matched") {
        personId = resolved.personId;
        matchedConfidence = resolved.confidence;
      } else if (resolved.kind === "suggested") {
        // Don't auto-merge AI suggestion — surface details to user.
        const { data: candidate } = await supabase
          .from("people")
          .select("id, full_name, primary_email")
          .eq("id", resolved.personId)
          .maybeSingle();
        return NextResponse.json({
          needsConfirmation: true,
          candidates: candidate ? [candidate] : [],
          reason: resolved.reason,
        });
      } else if (resolved.kind === "ambiguous") {
        const { data: candidates } = await supabase
          .from("people")
          .select("id, full_name, primary_email")
          .in("id", resolved.candidateIds);
        return NextResponse.json({
          needsConfirmation: true,
          candidates: candidates ?? [],
          reason: resolved.reason,
        });
      } else {
        // No match — need either an existing-person id, or enough info to create one.
        const haveId = !!(linkedin || email || sniffed.linkedin || sniffed.email);
        if (!name || !haveId) {
          return NextResponse.json({
            needsIdentity: true,
            reason: "Provide a name and a LinkedIn URL or email so we can create the person.",
          });
        }
        const { first, last } = splitFullName(name);
        const newEmail = email ?? sniffed.email ?? null;
        if (newEmail && !confirmMismatch && emailLooksMismatched(newEmail, first, last)) {
          return NextResponse.json({
            warning: "email_name_mismatch",
            message: `"${newEmail}" doesn't look like it belongs to ${name}. Save anyway?`,
          }, { status: 409 });
        }
        const { data: created, error: createErr } = await supabase
          .from("people")
          .insert({
            owner_id: ownerId,
            full_name: name,
            first_name: first || null,
            last_name: last,
            linkedin_url: linkedin ?? sniffed.linkedin ?? null,
            primary_email: newEmail,
          })
          .select("id")
          .single();
        if (createErr || !created) {
          return NextResponse.json({ error: createErr?.message ?? "Failed to create person" }, { status: 500 });
        }
        personId = created.id;
      }
    }

    // Steps 2-6 — pipeline
    const result = await logInteractionAndProcess(supabase, {
      personId,
      ownerId: ownerId,
      type: mode === "email" ? "pasted_email" : mode === "screenshot" ? "screenshot" : "manual_note",
      rawContent,
      matchedIdentityConfidence: matchedConfidence,
      extractionConfidence,
    });

    return NextResponse.json({ ok: true, personId, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
