import { NextResponse } from "next/server";
import { requireUserOrApiKey } from "@/lib/supabase/server";
import { feedCandidates } from "@/lib/feed";

export const maxDuration = 30;

export async function GET(req: Request) {
  const auth = await requireUserOrApiKey(req);
  if (auth instanceof Response) return auth;
  const { supabase } = auth;
  try {
    const items = await feedCandidates(supabase);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
