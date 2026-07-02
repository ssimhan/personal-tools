import { NextResponse } from "next/server";
import { requireUserOrApiKey } from "@/lib/supabase/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUserOrApiKey(req);
  if (auth instanceof Response) return auth;
  const { supabase, ownerId } = auth;
  const { name } = await req.json();
  if (typeof name !== "string" || !name.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  const trimmed = name.trim();

  // upsert tag (unique on owner_id+name)
  const { data: tag, error: tagErr } = await supabase
    .from("tags")
    .upsert({ owner_id: ownerId, name: trimmed }, { onConflict: "owner_id,name" })
    .select("id")
    .single();
  if (tagErr || !tag) return NextResponse.json({ error: tagErr?.message ?? "tag upsert failed" }, { status: 500 });

  const { error: linkErr } = await supabase
    .from("people_tags")
    .upsert({ person_id: id, tag_id: tag.id }, { onConflict: "person_id,tag_id" });
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, tagId: tag.id });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUserOrApiKey(req);
  if (auth instanceof Response) return auth;
  const { supabase } = auth;
  const tagId = new URL(req.url).searchParams.get("tag_id");
  if (!tagId) return NextResponse.json({ error: "tag_id required" }, { status: 400 });
  const { error } = await supabase
    .from("people_tags")
    .delete()
    .eq("person_id", id)
    .eq("tag_id", tagId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
