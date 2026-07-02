import { NextResponse } from "next/server";
import { requireUserOrApiKey } from "@/lib/supabase/server";

// Hard-delete a tag globally. FK cascade on people_tags removes all
// person-tag links automatically. People themselves are untouched.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUserOrApiKey(req);
  if (auth instanceof Response) return auth;
  const { supabase } = auth;

  const { error } = await supabase.from("tags").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
