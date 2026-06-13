import { NextResponse } from "next/server";
import { requireUserOrApiKey } from "@/lib/supabase/server";
import { search, parseSearchInput } from "@/lib/search";

export const maxDuration = 30;

export async function GET(req: Request) {
  const auth = await requireUserOrApiKey(req);
  if (auth instanceof Response) return auth;
  const { supabase } = auth;
  const url = new URL(req.url);

  try {
    const result = await search(supabase, parseSearchInput(url.searchParams));
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
