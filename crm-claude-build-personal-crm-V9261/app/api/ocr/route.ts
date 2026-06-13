import { NextResponse } from "next/server";
import { requireUserOrApiKey } from "@/lib/supabase/server";
import { extractTextFromImage } from "@/lib/ai/anthropic";

export const maxDuration = 60;

// Run an image through the vision model and return the extracted text only.
// No DB writes — the caller decides what to do with the text (typically pre-fill
// an interaction textarea so the user can edit before logging).
export async function POST(req: Request) {
  const auth = await requireUserOrApiKey(req);
  if (auth instanceof Response) return auth;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image uploaded" }, { status: 400 });
  }
  const mt = file.type;
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mt)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const base64 = Buffer.from(bytes).toString("base64");
  const out = await extractTextFromImage({
    base64,
    mediaType: mt as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
  });
  return NextResponse.json({ text: out.text, confidence: out.confidence });
}
