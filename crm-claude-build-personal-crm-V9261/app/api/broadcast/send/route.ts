import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { sendIndividualEmail } from "@/lib/resend";
import { logInteractionAndProcess } from "@/lib/pipeline";
import { config } from "@/lib/config";
import { contactUpdateState, footerLine, contactUpdateUrl, type ContactFooterData } from "@/lib/contact-footer";

export const maxDuration = 300;

interface MessageIn {
  personId: string;
  to: string;
  subject: string;
  intro: string;   // plain text, e.g. "Hey Riley,"
  body: string;    // HTML from the rich-text editor, may contain {{first_name}} / {{update_url}}
  closing: string; // plain text (optional)
}
interface Body { messages: MessageIn[] }

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// Replace {{first_name}} / {{update_url}} placeholders. Applied to intro,
// closing, and the HTML body (where it can also be the href of an <a> tag).
function substVars(s: string, vars: { firstName: string; updateUrl: string }): string {
  return s
    .replaceAll("{{first_name}}", vars.firstName)
    .replaceAll("{{update_url}}", vars.updateUrl);
}

// Convert TipTap HTML to a reasonable plain-text fallback. The editor only
// emits paragraphs, line breaks, bullet lists, inline marks, and links — so a
// targeted regex pass is enough; we don't need an HTML parser.
function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>(?:\n)?/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/p>/gi, "")
    .replace(/<ul[^>]*>/gi, "")
    .replace(/<\/ul>/gi, "\n")
    .replace(/<ol[^>]*>/gi, "")
    .replace(/<\/ol>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    // Anchors: replace "<a href="X">text</a>" with "text (X)" so the link is
    // recoverable in plain text.
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, text) =>
      String(text).trim() && String(href).trim() ? `${text} (${href})` : `${text}${href}`,
    )
    .replace(/<\/?(strong|b|em|i|span|div)[^>]*>/gi, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Per PRD §Sending — each recipient gets an INDIVIDUAL email (not a group thread).
// A contact-update footer is appended per recipient unless we already hold their
// complete info. On success, append a `broadcast_sent` interaction.
export async function POST(req: Request) {
  const { supabase, ownerId } = await requireUser();
  const { messages } = (await req.json()) as Body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "no messages" }, { status: 400 });
  }

  // Fetch recipient contact data once. first_name powers the {{first_name}}
  // variable; short_token/contact_token powers {{update_url}} and the footer.
  const personIds = messages.map((m) => m.personId);
  const { data: people } = await supabase
    .from("people")
    .select("id, full_name, first_name, primary_email, phone_number, preferred_channel, short_token, contact_token")
    .in("id", personIds);
  const byId = new Map((people ?? []).map((p) => [p.id, p]));

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const m of messages) {
    if (!m.to) { failed++; errors.push(`${m.personId}: no email`); continue; }

    const person = byId.get(m.personId);
    const firstName = person?.first_name?.trim() || person?.full_name?.split(/\s+/)[0] || "";
    const token = person && (person.short_token ?? person.contact_token);
    const updateUrl = person && config.appBaseUrl && token
      ? contactUpdateUrl(config.appBaseUrl, token)
      : "";

    const vars = { firstName, updateUrl };
    const intro = substVars(m.intro, vars);
    const bodyHtml = substVars(m.body, vars);
    const closing = substVars(m.closing, vars);

    // Footer line (appended after the body).
    const line = person && config.appBaseUrl
      ? footerLine(contactUpdateState(person as ContactFooterData))
      : null;
    const footerUrl = line && updateUrl ? updateUrl : null;

    // Plain-text version: intro + body-as-text + closing + footer line + url.
    const textParts = [intro, htmlToPlain(bodyHtml), closing].filter((s) => s && s.trim()).join("\n\n");
    const textFooter = line && footerUrl ? `\n\n—\n${line}\n${footerUrl}` : "";
    const text = `${textParts}${textFooter}`;

    // HTML: intro/closing get newlines→<br>; body is already HTML; footer is hyperlinked.
    const introHtml = intro ? `<p>${escapeHtml(intro).replace(/\n/g, "<br>")}</p>` : "";
    const closingHtml = closing ? `<p>${escapeHtml(closing).replace(/\n/g, "<br>")}</p>` : "";
    const footerHtml = line && footerUrl
      ? `<p>—<br>${escapeHtml(line)} <a href="${footerUrl}">update your info</a></p>`
      : "";
    const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.5">${introHtml}${bodyHtml}${closingHtml}${footerHtml}</div>`;

    try {
      await sendIndividualEmail({ to: m.to, subject: m.subject, text, html });
      await logInteractionAndProcess(supabase, {
        ownerId,
        personId: m.personId,
        type: "broadcast_sent",
        rawContent: `Subject: ${m.subject}\n\n${text}`,
      });
      sent++;
    } catch (e) {
      failed++;
      errors.push(`${m.personId}: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  return NextResponse.json({ sent, failed, errors });
}
