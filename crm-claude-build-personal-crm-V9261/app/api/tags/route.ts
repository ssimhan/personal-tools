import { NextResponse } from "next/server";
import { requireUserOrApiKey } from "@/lib/supabase/server";

// Create a standalone tag (not attached to any person). Used by the Admin page.
export async function POST(req: Request) {
  const auth = await requireUserOrApiKey(req);
  if (auth instanceof Response) return auth;
  const { supabase, ownerId } = auth;

  const { name } = await req.json();
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tags")
    .upsert({ owner_id: ownerId, name: name.trim() }, { onConflict: "owner_id,name" })
    .select("id, name")
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "create failed" }, { status: 500 });
  return NextResponse.json({ ok: true, tag: data });
}
