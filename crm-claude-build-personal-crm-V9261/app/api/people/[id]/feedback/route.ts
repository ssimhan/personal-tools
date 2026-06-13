import { NextResponse } from "next/server";
import { requireUserOrApiKey } from "@/lib/supabase/server";

// Per-row feedback actions from the Feed:
//   - "up"     → value += 1
//   - "down"   → value -= 1
//   - "snooze" → snoozed_until = now() + 30 days (contact hides until then)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUserOrApiKey(req);
  if (auth instanceof Response) return auth;
  const { supabase } = auth;

  const body = (await req.json()) as { kind?: string };
  const kind = body.kind;

  if (kind === "up" || kind === "down") {
    // Fetch then write — single-user CRM, no real concurrency.
    const { data: row, error: fetchErr } = await supabase
      .from("people")
      .select("value")
      .eq("id", id)
      .single();
    if (fetchErr || !row) return NextResponse.json({ error: "person not found" }, { status: 404 });
    const next = (row.value ?? 0) + (kind === "up" ? 1 : -1);
    const { error: updErr } = await supabase.from("people").update({ value: next }).eq("id", id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, value: next });
  }

  if (kind === "snooze") {
    const until = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const { error: updErr } = await supabase
      .from("people")
      .update({ snoozed_until: until })
      .eq("id", id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, snoozed_until: until });
  }

  return NextResponse.json({ error: "unknown kind" }, { status: 400 });
}
