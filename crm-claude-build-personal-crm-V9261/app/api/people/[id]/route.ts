import { NextResponse } from "next/server";
import { requireUserOrApiKey } from "@/lib/supabase/server";

// Full person hydration by id — same response shape as /api/people/by-linkedin
// so the extension popup can use either entry point interchangeably.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUserOrApiKey(req);
  if (auth instanceof Response) return auth;
  const { supabase } = auth;

  const { data: person, error } = await supabase
    .from("people")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!person) return NextResponse.json({ person: null }, { status: 404 });

  const [{ data: ixs }, { data: tagRows }, { data: allTagRows }] = await Promise.all([
    supabase
      .from("interactions")
      .select("id, interaction_type, raw_content, created_at")
      .eq("person_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("people_tags")
      .select("tags(id, name)")
      .eq("person_id", id),
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

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUserOrApiKey(req);
  if (auth instanceof Response) return auth;
  const { supabase } = auth;
  // FK cascades drop interactions and people_tags automatically.
  const { error } = await supabase.from("people").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Partial update of a small whitelist of person fields. Used by the Chrome
// extension's channel editor (click a channel icon → edit its value).
// Not a general-purpose person update — RPCs with embedding consequences
// (summary, notes, emails, preferred_channel) keep their dedicated endpoints.
const PATCHABLE = ["linkedin_url", "phone_number", "slack_channel"] as const;
type Patchable = (typeof PATCHABLE)[number];
const VALID_CHANNELS = new Set(["email", "linkedin", "phone", "slack", "text"]);
const VALID_TEXT_METHODS = new Set(["sms", "whatsapp"]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUserOrApiKey(req);
  if (auth instanceof Response) return auth;
  const { supabase } = auth;

  const body = (await req.json()) as Record<string, unknown>;
  const update: Record<string, string | number | boolean | null> = {};
  for (const key of PATCHABLE) {
    if (key in body) {
      const v = body[key];
      if (v === null || v === "") update[key] = null;
      else if (typeof v === "string") update[key] = v.trim();
    }
  }
  if ("preferred_channel" in body) {
    const v = body.preferred_channel;
    if (v === null || v === "") update.preferred_channel = null;
    else if (typeof v === "string" && VALID_CHANNELS.has(v)) update.preferred_channel = v;
    else return NextResponse.json({ error: "invalid preferred_channel" }, { status: 400 });
  }
  if ("text_method" in body) {
    const v = body.text_method;
    if (v === null || v === "") update.text_method = null;
    else if (typeof v === "string" && VALID_TEXT_METHODS.has(v)) update.text_method = v;
    else return NextResponse.json({ error: "invalid text_method" }, { status: 400 });
  }
  if ("broadcast_months" in body) {
    const v = body.broadcast_months;
    if (v === null || v === "" || v === "none") update.broadcast_months = null;
    else {
      const n = Number(v);
      if ([2, 4, 6, 8].includes(n)) update.broadcast_months = n;
      else return NextResponse.json({ error: "invalid broadcast_months" }, { status: 400 });
    }
  }
  if ("accepts_asks" in body) {
    const v = body.accepts_asks;
    if (v === null || v === "") update.accepts_asks = null;
    else if (v === true || v === false) update.accepts_asks = v;
    else return NextResponse.json({ error: "invalid accepts_asks" }, { status: 400 });
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no patchable fields provided" }, { status: 400 });
  }

  const { error } = await supabase.from("people").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
