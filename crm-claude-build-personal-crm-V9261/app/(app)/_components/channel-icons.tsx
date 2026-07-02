"use client";

import { Mail, Linkedin, Phone, MessageCircle, Hash } from "lucide-react";

type Channel = "email" | "linkedin" | "phone" | "text" | "slack";

interface ChannelData {
  primary_email: string | null;
  linkedin_url: string | null;
  phone_number: string | null;
  slack_channel: string | null;
  preferred_channel: string | null;
  text_method: string | null;
}

const ICONS: Array<{ key: Channel; icon: React.ComponentType<{ className?: string }>; label: string }> = [
  { key: "email", icon: Mail, label: "Email" },
  { key: "linkedin", icon: Linkedin, label: "LinkedIn" },
  { key: "phone", icon: Phone, label: "Phone" },
  { key: "text", icon: MessageCircle, label: "Text" },
  { key: "slack", icon: Hash, label: "Slack" },
];

// Interactive channel indicators for list rows.
//   green = preferred · blue = have a value · faded gray = missing
// Click behavior:
//   - email → Gmail compose to them; text → WhatsApp/SMS; phone → call;
//     linkedin/slack → open the URL. (The contact-update footer is no longer
//     prefilled here — it's a copy button on the Person Page.)
//   - missing channel → onEdit (parent opens the contact editor).
export function ChannelIcons({ p, onEdit }: { p: ChannelData; onEdit?: () => void }) {
  const present = (k: Channel): boolean => {
    switch (k) {
      case "email": return !!p.primary_email;
      case "linkedin": return !!p.linkedin_url;
      case "phone": return !!p.phone_number;
      case "text": return !!p.phone_number; // texting uses the phone number
      case "slack": return !!p.slack_channel;
    }
  };

  const href = (k: Channel): string | null => {
    switch (k) {
      case "email":
        return p.primary_email
          ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(p.primary_email)}`
          : null;
      case "linkedin": return p.linkedin_url;
      case "phone": return p.phone_number ? `tel:${p.phone_number}` : null;
      case "text": {
        if (!p.phone_number) return null;
        // Default to SMS unless the contact has explicitly opted into WhatsApp.
        if (p.text_method === "whatsapp") {
          const digits = p.phone_number.replace(/\D/g, "");
          if (digits) return `https://wa.me/${digits}`;
        }
        return `sms:${p.phone_number}`;
      }
      case "slack": return p.slack_channel;
    }
  };

  return (
    <div className="flex items-center gap-1">
      {ICONS.map(({ key, icon: Icon, label }) => {
        const have = present(key);
        const preferred = p.preferred_channel === key;
        const cls = preferred
          ? "text-green-600 dark:text-green-400"
          : have
            ? "text-blue-600 dark:text-blue-400"
            : "text-muted-foreground/30";
        const link = href(key);

        if (link) {
          // Only http(s) links open in a new tab. mailto:/sms:/tel: must open
          // in place so the OS hands them to the mail/SMS/phone app (a _blank
          // target just leaves an empty about:blank tab behind).
          const external = link.startsWith("http");
          return (
            <a
              key={key}
              href={link}
              {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
              title={label}
              onClick={(e) => e.stopPropagation()}
              className={`${cls} hover:opacity-70`}
            >
              <Icon className="h-3.5 w-3.5" />
            </a>
          );
        }
        return (
          <button
            key={key}
            type="button"
            title={`Add ${label}`}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit?.(); }}
            className={`${cls} hover:opacity-70`}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
