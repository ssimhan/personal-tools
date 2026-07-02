import { Resend } from "resend";
import { config, requireApiKeys } from "@/lib/config";

let _client: Resend | null = null;
function client() {
  if (!_client) _client = new Resend(requireApiKeys().resend);
  return _client;
}

export async function sendIndividualEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ id: string }> {
  if (!config.resendFromEmail) throw new Error("RESEND_FROM_EMAIL not configured");
  const res = await client().emails.send({
    from: config.resendFromEmail,
    to: opts.to,
    subject: opts.subject,
    text: opts.text, // plain-text fallback
    ...(opts.html ? { html: opts.html } : {}),
  });
  if (res.error) throw new Error(`Resend error: ${res.error.message}`);
  return { id: res.data?.id ?? "" };
}
