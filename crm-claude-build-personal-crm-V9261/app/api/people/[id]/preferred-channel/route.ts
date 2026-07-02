import { NextResponse } from "next/server";
import { requireUserOrApiKey } from "@/lib/supabase/server";

const VALID = new Set(["email", "linkedin", "phone", "slack", "whatsapp"]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUserOrApiKey(req);
  if (auth instanceof Response) return auth;
  const { supabase } = auth;
  const { channel } = await req.json();

  if (channel !== null && (typeof channel !== "string" || !VALID.has(channel))) {
    return NextResponse.json({ error: "invalid channel" }, { status: 400 });
  }

  const { error } = await supabase
    .from("people")
    .update({ preferred_channel: channel })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
