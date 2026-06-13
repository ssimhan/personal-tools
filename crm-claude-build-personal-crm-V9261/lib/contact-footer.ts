// Single source of truth for the contact-update footer / draft logic.
// Pure functions — used both server-side (broadcast send) and client-side
// (channel-icon draft links).

export interface ContactFooterData {
  primary_email: string | null;
  phone_number: string | null;
  preferred_channel: string | null;
}

export type ContactUpdateState = "complete" | "missing_info" | "no_preferred";

export function contactUpdateState(p: ContactFooterData): ContactUpdateState {
  if (!p.preferred_channel) return "no_preferred";
  if (!p.primary_email || !p.phone_number) return "missing_info";
  return "complete";
}

// Lead-in sentence (no URL). Always returns a line — every contact gets the
// update link in their footer; the phrasing changes by state.
export function footerLine(state: ContactUpdateState): string {
  switch (state) {
    case "no_preferred": return "What's the best channel to reach you on?";
    case "missing_info": return "Do I have the right contact info for you?";
    case "complete": return "Here is the contact info I have for you. Is everything up to date?";
  }
}

export function contactUpdateUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}/c/${token}`;
}

// Convenience: the plain-text footer block (line + url on its own line).
export function footerTextBlock(p: ContactFooterData, baseUrl: string, token: string): string {
  const line = footerLine(contactUpdateState(p));
  return `${line}\n${contactUpdateUrl(baseUrl, token)}`;
}
