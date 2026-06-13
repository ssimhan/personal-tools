import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";

// Manage a person's emails: add, delete, promote to primary.
// Body: { action: "add" | "delete" | "make_primary", email: string }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { action, email } = (await req.json()) as { action?: string; email?: string };

  const e = email?.trim().toLowerCase() ?? "";
  if (!e) return NextResponse.json({ error: "email required" }, { status: 400 });

  const { data: person, error: fetchErr } = await supabase
    .from("people")
    .select("primary_email, secondary_emails")
    .eq("id", id)
    .single();
  if (fetchErr || !person) return NextResponse.json({ error: "person not found" }, { status: 404 });

  const primary = person.primary_email?.toLowerCase() ?? null;
  const secondary = new Set<string>((person.secondary_emails ?? []).map((s: string) => s.toLowerCase()));

  let newPrimary: string | null = primary;
  let newSecondary = secondary;

  if (action === "add") {
    if (primary === e || secondary.has(e)) {
      return NextResponse.json({ error: "email already present" }, { status: 409 });
    }
    if (!primary) {
      newPrimary = e;
    } else {
      newSecondary = new Set([...secondary, e]);
    }
  } else if (action === "delete") {
    if (primary === e) {
      // Promote the first secondary email (if any) so we don't leave the person
      // primary-less when other addresses are still on file.
      const remaining = [...secondary];
      newPrimary = remaining.shift() ?? null;
      newSecondary = new Set(remaining);
    } else if (secondary.has(e)) {
      newSecondary = new Set([...secondary].filter((x) => x !== e));
    } else {
      return NextResponse.json({ error: "email not found on this person" }, { status: 404 });
    }
  } else if (action === "make_primary") {
    if (primary === e) return NextResponse.json({ ok: true }); // already primary
    if (!secondary.has(e)) return NextResponse.json({ error: "email not on this person" }, { status: 404 });
    newSecondary = new Set([...secondary].filter((x) => x !== e));
    if (primary) newSecondary.add(primary); // swap old primary into secondary
    newPrimary = e;
  } else {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  const { error: updErr } = await supabase
    .from("people")
    .update({
      primary_email: newPrimary,
      secondary_emails: Array.from(newSecondary),
    })
    .eq("id", id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, primary: newPrimary, secondary: Array.from(newSecondary) });
}
