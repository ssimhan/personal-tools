import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { revertSummary } from "@/lib/pipeline";

export const maxDuration = 30;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  try {
    const ok = await revertSummary(supabase, id);
    if (!ok) return NextResponse.json({ error: "no prior snapshot" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
