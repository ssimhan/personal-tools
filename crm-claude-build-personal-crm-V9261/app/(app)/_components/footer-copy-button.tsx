"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { contactUpdateUrl, type ContactFooterData } from "@/lib/contact-footer";

export interface FooterCopyData extends ContactFooterData {
  short_token: string | null;
  contact_token: string | null; // legacy UUID fallback
}

// Small icon-only button used in list rows (Search, Feed). Builds the
// contact-update footer (line + link) and copies it to the clipboard. Falls
// back to the legacy contact_token UUID when short_token isn't populated yet.
export function FooterCopyButton({
  person,
  appBaseUrl,
  className = "",
}: {
  person: FooterCopyData;
  appBaseUrl: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const buildText = (): string | null => {
    const token = person.short_token ?? person.contact_token;
    if (!token) return null;
    const origin = appBaseUrl || (typeof window !== "undefined" ? window.location.origin : "");
    if (!origin) return null;
    // Just the URL — no lead-in line. Callers paste it wherever they want.
    return contactUpdateUrl(origin, token);
  };

  const onCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const text = buildText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      title="Copy contact-update footer (line + link)"
      aria-label="Copy contact-update footer"
      className={`text-muted-foreground hover:text-foreground ${className}`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
