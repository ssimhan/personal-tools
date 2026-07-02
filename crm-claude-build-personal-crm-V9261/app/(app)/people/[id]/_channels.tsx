"use client";

import { useState } from "react";
import { Mail, Linkedin, Phone, MessageCircle, Hash, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactEditor } from "./_contact-editor";
import { BroadcastControl } from "@/app/(app)/_components/broadcast-picker";
import { AskControl } from "@/app/(app)/_components/ask-picker";
import { contactUpdateUrl, type ContactFooterData } from "@/lib/contact-footer";

type Channel = "email" | "linkedin" | "phone" | "text" | "slack";

interface Person extends ContactFooterData {
  id: string;
  primary_email: string | null;
  secondary_emails: string[] | null;
  linkedin_url: string | null;
  phone_number: string | null;
  slack_channel: string | null;
  preferred_channel: Channel | null;
  text_method: string | null;
  short_token: string | null;
  contact_token: string | null; // legacy UUID — used as a fallback if short_token isn't populated yet
  broadcast_months: number | null;
  accepts_asks: boolean | null;
}

const CHANNELS: Array<{ key: Channel; icon: React.ComponentType<{ className?: string }>; label: string }> = [
  { key: "email", icon: Mail, label: "Email" },
  { key: "linkedin", icon: Linkedin, label: "LinkedIn" },
  { key: "phone", icon: Phone, label: "Phone" },
  { key: "text", icon: MessageCircle, label: "Text" },
  { key: "slack", icon: Hash, label: "Slack" },
];

export function ChannelDots({ person, appBaseUrl }: { person: Person; appBaseUrl: string }) {
  const [copied, setCopied] = useState(false);

  const have = (k: Channel): boolean => {
    switch (k) {
      case "email": return !!person.primary_email;
      case "linkedin": return !!person.linkedin_url;
      case "phone": return !!person.phone_number;
      case "text": return !!person.phone_number; // texting uses the phone number
      case "slack": return !!person.slack_channel;
    }
  };

  // The footer text the user can paste into a manual email/text/DM. Uses the
  // state-appropriate line, or a friendly default when we already have
  // everything, plus the contact's personal update link.
  const footerText = (): string | null => {
    // Prefer the new short_token; fall back to the legacy contact_token UUID
    // so the Footer button works even if migration 0013 hasn't been applied yet.
    const token = person.short_token ?? person.contact_token;
    if (!token) return null;
    // Prefer the server-configured canonical URL so the copied link is always
    // crm.andymowat.com regardless of which host the page is being viewed from.
    const origin =
      appBaseUrl || (typeof window !== "undefined" ? window.location.origin : "");
    if (!origin) return null;
    // Just the URL — no lead-in line.
    return contactUpdateUrl(origin, token);
  };

  const copyFooter = async () => {
    const text = footerText();
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
    <div className="flex items-center gap-3 text-sm flex-wrap">
      <div className="flex items-center gap-1">
        {CHANNELS.map(({ key, icon: Icon, label }) => {
          const present = have(key);
          const isPreferred = person.preferred_channel === key;
          const waDigits = person.phone_number?.replace(/\D/g, "") || "";

          let href: string | null = null;
          if (key === "email" && person.primary_email) {
            // Gmail compose — reliable prefill (mailto: handoff is flaky).
            href = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(person.primary_email)}`;
          } else if (key === "linkedin" && person.linkedin_url) {
            href = person.linkedin_url;
          } else if (key === "phone" && person.phone_number) {
            href = `tel:${person.phone_number}`;
          } else if (key === "text" && person.phone_number) {
            // Default to SMS unless the contact has explicitly opted into WhatsApp.
            if (person.text_method === "whatsapp" && waDigits) href = `https://wa.me/${waDigits}`;
            else href = `sms:${person.phone_number}`;
          } else if (key === "slack" && person.slack_channel) {
            href = person.slack_channel;
          }
          const actionable = present && !!href;

          const colorClass = isPreferred
            ? "text-green-600 dark:text-green-400"
            : present
              ? "text-blue-600 dark:text-blue-400"
              : "text-muted-foreground/40";

          const Wrap = actionable && href ? "a" : "span";
          // Only http(s) opens in a new tab; sms:/tel: open in place
          // so the OS hands off to the right app instead of leaving a blank tab.
          const external = !!href && href.startsWith("http");
          const props: { href?: string; target?: string; rel?: string; title?: string } =
            actionable && href
              ? {
                  href,
                  ...(external ? { target: "_blank", rel: "noreferrer" } : {}),
                  title: isPreferred ? `${label} (preferred)` : label,
                }
              : { title: isPreferred ? `${label} (preferred)` : label };

          return (
            <Wrap
              key={key}
              {...props}
              className={[
                "inline-flex items-center gap-1 rounded-md px-2 py-1",
                colorClass,
                actionable ? "hover:bg-accent" : "",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
            </Wrap>
          );
        })}
      </div>

      <ContactEditor
        personId={person.id}
        initial={{
          primary_email: person.primary_email,
          secondary_emails: person.secondary_emails,
          linkedin_url: person.linkedin_url,
          phone_number: person.phone_number,
          slack_channel: person.slack_channel,
          preferred_channel: person.preferred_channel,
          text_method: (person.text_method as "sms" | "whatsapp" | null) ?? null,
        }}
      />

      <Button size="sm" variant="outline" onClick={copyFooter} title="Copy the contact-update prompt + link to paste into a message">
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Footer"}
      </Button>

      <BroadcastControl personId={person.id} initial={person.broadcast_months} />

      <AskControl personId={person.id} initial={person.accepts_asks} />
    </div>
  );
}
