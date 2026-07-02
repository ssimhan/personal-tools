import { NextResponse } from "next/server";
import { requireUserOrApiKey } from "@/lib/supabase/server";
import { applyManualSummaryEdit } from "@/lib/pipeline";

export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUserOrApiKey(req);
  if (auth instanceof Response) return auth;
  const { supabase } = auth;
  const { summary } = await req.json();
  if (typeof summary !== "string") return NextResponse.json({ error: "summary must be string" }, { status: 400 });
  try {
    await applyManualSummaryEdit(supabase, id, summary);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
