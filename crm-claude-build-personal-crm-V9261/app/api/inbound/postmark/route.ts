import { NextResponse } from "next/server";
import { admin, getExtensionOwnerId } from "@/lib/supabase/admin";
import { config } from "@/lib/config";
import { logInteractionAndProcess } from "@/lib/pipeline";

// Inbound "BCC to log": Postmark receives an email you BCC'd and POSTs the
// parsed message here. We find contacts whose email is in the To field and log
// the email as a pasted_email interaction on each (which regenerates their
// summary). Authed by a shared secret in the ?token= query param.
export const maxDuration = 300;

interface PostmarkInbound {
  FromFull?: { Email?: string; Name?: string };
  ToFull?: Array<{ Email?: string; Name?: string }>;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  MessageID?: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!config.inboundEmailSecret || token !== config.inboundEmailSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: PostmarkInbound;
  try {
    payload = (await req.json()) as PostmarkInbound;
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const toEmails = Array.from(
    new Set(
      (payload.ToFull ?? [])
        .map((t) => t.Email?.trim().toLowerCase())
        .filter((e): e is string => !!e),
    ),
  );
  if (toEmails.length === 0) {
    return NextResponse.json({ ok: true, logged: 0, note: "no To addresses" });
  }

  const db = admin();
  let ownerId: string;
  try {
    ownerId = await getExtensionOwnerId();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "owner lookup failed" }, { status: 500 });
  }

  // Match contacts whose primary OR any secondary email is in the To field.
  // Matching is case-/whitespace-insensitive on both sides (done in SQL).
  const { data: matched, error: matchErr } = await db.rpc("find_people_by_emails", {
    owner: ownerId,
    emails: toEmails,
  });
  if (matchErr) {
    return NextResponse.json({ error: `match failed: ${matchErr.message}` }, { status: 500 });
  }
  const personIds = new Set<string>((matched ?? []).map((r: { id: string }) => r.id));
  if (personIds.size === 0) {
    return NextResponse.json({ ok: true, logged: 0, note: "no matching contacts" });
  }

  const subject = payload.Subject?.trim() || "(no subject)";
  const body = payload.TextBody?.trim() || (payload.HtmlBody ? stripHtml(payload.HtmlBody) : "");
  // Mark outgoing direction explicitly so the summary regen knows that any
  // first-person ("I", "my", "I'll") in this email refers to the user, NOT to
  // the contact whose record we're logging onto.
  const marker = `[Outgoing email — sent by me (the CRM owner) to this contact. First person ("I", "my", "I'll") refers to me, not the contact.]`;
  const rawContent = `${marker}\nSubject: ${subject}\n\n${body}`.slice(0, 20000);
  const messageId = payload.MessageID || "";
  const source = messageId ? `email_bcc:${messageId}` : "email_bcc";

  let logged = 0;
  for (const personId of personIds) {
    // Dedupe: Postmark retries on non-2xx — skip if we already logged this
    // message for this person.
    if (messageId) {
      const { data: existing } = await db
        .from("interactions")
        .select("id")
        .eq("person_id", personId)
        .eq("source", source)
        .limit(1);
      if (existing && existing.length) continue;
    }
    try {
      await logInteractionAndProcess(db, {
        personId,
        ownerId,
        type: "pasted_email",
        rawContent,
        source,
      });
      logged++;
    } catch (e) {
      console.error("inbound log failed for", personId, e);
    }
  }

  return NextResponse.json({ ok: true, logged });
}
