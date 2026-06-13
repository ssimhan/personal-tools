import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";

export const maxDuration = 30;

interface Body {
  personIds: string[];
  subject: string;
  body: string;
}

// Builds one draft per recipient. AI personalization is intentionally OFF —
// each draft is just "Hey <first>,\n\n<canonical body>" with no AI-generated
// intro or closing. Per the user: better no personalization than bad
// personalization (until we have enough relationship context per person).
export async function POST(req: Request) {
  const { supabase } = await requireUser();
  const { personIds, subject, body } = (await req.json()) as Body;
  if (!Array.isArray(personIds) || personIds.length === 0 || !body) {
    return NextResponse.json({ error: "personIds and body required" }, { status: 400 });
  }

  const { data: people } = await supabase
    .from("people")
    .select("id, full_name, first_name, primary_email")
    .in("id", personIds);

  const drafts = (people ?? []).map((p) => {
    const first = p.first_name?.trim() || p.full_name.split(/\s+/)[0] || p.full_name;
    return {
      personId: p.id,
      to: p.primary_email ?? "",
      fullName: p.full_name,
      intro: `Hey ${first},`,
      closing: "",
      body,
      subject,
      hasContext: false,
    };
  });

  return NextResponse.json({ drafts });
}
