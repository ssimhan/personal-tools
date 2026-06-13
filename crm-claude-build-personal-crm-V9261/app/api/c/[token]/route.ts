import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase/admin";
import { config } from "@/lib/config";
import { sendIndividualEmail } from "@/lib/resend";

export const maxDuration = 30;

const VALID_CHANNELS = new Set(["email", "linkedin", "phone", "slack", "text"]);
const VALID_TEXT_METHODS = new Set(["sms", "whatsapp"]);

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

interface Body {
  primary_email?: string | null;
  phone_number?: string | null;
  linkedin_url?: string | null;
  text_method?: string | null;
  preferred_channel?: string | null;
  accepts_asks?: boolean | null;
}

const FIELD_LABELS: Record<string, string> = {
  primary_email: "Email",
  phone_number: "Phone",
  linkedin_url: "LinkedIn",
  text_method: "Text method",
  preferred_channel: "Preferred channel",
  accepts_asks: "Open to asks",
};

// Public, token-authed contact self-update. No login — the token is the
// capability. Uses the service-role client (bypasses RLS) to load/update the
// one person the token points at, and logs the change as a contact_update
// interaction with an old→new diff (including deletions).
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = admin();

  // Accept either the new short_token or the legacy contact_token UUID so old
  // links in already-sent emails keep working.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
  const lookupColumn = isUuid ? "contact_token" : "short_token";
  const { data: person, error: fetchErr } = await db
    .from("people")
    .select("id, owner_id, full_name, primary_email, phone_number, linkedin_url, slack_channel, text_method, preferred_channel, accepts_asks")
    .eq(lookupColumn, token)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!person) return NextResponse.json({ error: "invalid token" }, { status: 404 });

  const body = (await req.json()) as Body;

  // Normalize incoming values.
  const next: Record<string, string | boolean | null> = {};
  if ("primary_email" in body) next.primary_email = body.primary_email?.trim().toLowerCase() || null;
  if ("phone_number" in body) next.phone_number = body.phone_number?.trim() || null;
  if ("linkedin_url" in body) next.linkedin_url = body.linkedin_url?.trim() || null;
  if ("text_method" in body) {
    const v = body.text_method;
    if (v && !VALID_TEXT_METHODS.has(v)) return NextResponse.json({ error: "invalid text_method" }, { status: 400 });
    next.text_method = v || null;
  }
  if ("preferred_channel" in body) {
    const v = body.preferred_channel;
    if (v && !VALID_CHANNELS.has(v)) return NextResponse.json({ error: "invalid preferred_channel" }, { status: 400 });
    next.preferred_channel = v || null;
  }
  if ("accepts_asks" in body) {
    const v = body.accepts_asks;
    if (v === null || v === undefined) next.accepts_asks = null;
    else if (v === true || v === false) next.accepts_asks = v;
    else return NextResponse.json({ error: "invalid accepts_asks" }, { status: 400 });
  }

  // Build a human-readable diff for the interaction log.
  const diffs: string[] = [];
  for (const key of Object.keys(next)) {
    const before = (person as Record<string, unknown>)[key] ?? null;
    const after = next[key];
    if ((before ?? null) !== (after ?? null)) {
      diffs.push(`${FIELD_LABELS[key] ?? key}: ${before ?? "(none)"} → ${after ?? "(none)"}`);
    }
  }

  if (Object.keys(next).length > 0) {
    const { error: updErr } = await db.from("people").update(next).eq("id", person.id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // Log the change (skip if nothing actually changed). Inserted directly — no
  // summary/embedding regen (contact info isn't relationship context).
  if (diffs.length > 0) {
    await db.from("interactions").insert({
      owner_id: person.owner_id,
      person_id: person.id,
      interaction_type: "contact_update",
      raw_content: `${person.full_name} updated their contact info via the self-service link:\n` + diffs.join("\n"),
      source: "contact_self_update",
    });

    // Notify the owner by email so they can see what changed without having to
    // open the app. Best-effort — never block the response on a mail failure.
    const notifyTo = config.canonicalOwnerEmail || config.allowedEmails[0] || null;
    if (notifyTo && config.appBaseUrl && config.resendFromEmail) {
      const personUrl = `${config.appBaseUrl.replace(/\/$/, "")}/people/${person.id}`;

      // Post-update state — merge the change set onto the pre-fetched person so
      // we can show the contact's *current* email + preferred channel info.
      const after = { ...(person as Record<string, unknown>), ...next };
      const email = (after.primary_email as string | null) ?? null;
      const pref = (after.preferred_channel as string | null) ?? null;
      const preferredLabel = (() => {
        switch (pref) {
          case "email": return `Email (${email ?? "(none on file)"})`;
          case "linkedin": return `LinkedIn (${(after.linkedin_url as string | null) ?? "(none on file)"})`;
          case "phone": return `Phone (${(after.phone_number as string | null) ?? "(none on file)"})`;
          case "text": {
            const num = (after.phone_number as string | null) ?? "(none on file)";
            const method = (after.text_method as string | null) ?? null;
            const methodLabel = method === "whatsapp" ? "WhatsApp" : method === "sms" ? "SMS" : "no method picked";
            return `Text (${num} · ${methodLabel})`;
          }
          case "slack": return `Slack (${(after.slack_channel as string | null) ?? "(none on file)"})`;
          default: return "No preference";
        }
      })();

      const text = [
        `${person.full_name} just updated their contact info via the self-service link.`,
        "",
        "Changes:",
        ...diffs.map((d) => `- ${d}`),
        "",
        "Contact Info:",
        `- Email: ${email ?? "(none)"}`,
        `- Preferred Channel: ${preferredLabel}`,
        "",
        `View their record: ${personUrl}`,
      ].join("\n");
      const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.5">
  <p><strong>${escapeHtml(person.full_name)}</strong> just updated their contact info via the self-service link.</p>
  <p><strong>Changes:</strong></p>
  <ul>${diffs.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>
  <p><strong>Contact Info:</strong></p>
  <ul>
    <li>Email: ${escapeHtml(email ?? "(none)")}</li>
    <li>Preferred Channel: ${escapeHtml(preferredLabel)}</li>
  </ul>
  <p><a href="${personUrl}">View their record in the CRM →</a></p>
</div>`;
      try {
        await sendIndividualEmail({
          to: notifyTo,
          subject: `${person.full_name} updated their contact info`,
          text,
          html,
        });
      } catch (e) {
        console.error("contact-update notification email failed:", e);
      }
    }
  }

  return NextResponse.json({ ok: true, changed: diffs.length });
}
