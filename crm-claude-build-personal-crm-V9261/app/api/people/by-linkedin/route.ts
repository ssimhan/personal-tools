import { NextResponse } from "next/server";
import { requireUserOrApiKey } from "@/lib/supabase/server";
import { normalizeLinkedIn } from "@/lib/identity";

export const maxDuration = 30;

// Look up a person by LinkedIn URL. Returns the person plus recent
// interactions and tags so the Chrome extension popup can render the full
// PersonCard in a single round trip. Returns { person: null } (200) when
// no match — callers use that to decide whether to show the Add Contact form.
export async function GET(req: Request) {
  const auth = await requireUserOrApiKey(req);
  if (auth instanceof Response) return auth;
  const { supabase } = auth;

  const raw = new URL(req.url).searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "url required" }, { status: 400 });
  const normalized = normalizeLinkedIn(raw);

  const { data: person, error } = await supabase
    .from("people")
    .select("*")
    .eq("linkedin_url", normalized)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!person) return NextResponse.json({ person: null });

  const [{ data: ixs }, { data: tagRows }, { data: allTagRows }] = await Promise.all([
    supabase
      .from("interactions")
      .select("id, interaction_type, raw_content, created_at")
      .eq("person_id", person.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("people_tags")
      .select("tags(id, name)")
      .eq("person_id", person.id),
    supabase.from("tags").select("id, name").order("name"),
  ]);

  const tags = (tagRows ?? [])
    .flatMap((r) => (Array.isArray(r.tags) ? r.tags : r.tags ? [r.tags] : []))
    .filter(Boolean) as unknown as { id: string; name: string }[];

  return NextResponse.json({
    person,
    recentInteractions: ixs ?? [],
    tags,
    allTags: allTagRows ?? [],
  });
}
