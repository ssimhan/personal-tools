"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { AskPicker, TextMethodPicker } from "@/app/(app)/_components/ask-picker";
import { PhoneInput } from "@/app/(app)/_components/phone-input";

type Channel = "email" | "linkedin" | "phone" | "slack" | "text";

interface Props {
  token: string;
  hasSlack: boolean;
  initial: {
    primary_email: string | null;
    phone_number: string | null;
    linkedin_url: string | null;
    text_method: "sms" | "whatsapp" | null;
    preferred_channel: Channel | null;
    accepts_asks: boolean | null;
  };
}

const ALL_CHANNELS: Array<{ value: Channel; label: string }> = [
  { value: "email", label: "Email" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "phone", label: "Phone (call)" },
  { value: "text", label: "Text" },
  { value: "slack", label: "Slack" },
];

// Module-scope so this component reference is stable across renders. (Defining
// it inside the parent component caused the Phone <Input> to lose focus on
// every keystroke because React saw a new component type each render.)
function Row({
  label, children, align = "center",
}: { label: string; children: React.ReactNode; align?: "start" | "center" }) {
  return (
    <div className={`flex gap-3 ${align === "start" ? "items-start" : "items-center"}`}>
      <Label className="w-28 shrink-0 text-sm font-medium">{label}</Label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function PublicContactForm({ token, hasSlack, initial }: Props) {
  // Only offer Slack as a preferred channel if we actually have a Slack handle
  // for them — otherwise it's noise to the contact.
  const channels = ALL_CHANNELS.filter((c) => c.value !== "slack" || hasSlack);
  const [email, setEmail] = useState(initial.primary_email ?? "");
  const [phone, setPhone] = useState(initial.phone_number ?? "");
  const [linkedin, setLinkedin] = useState(initial.linkedin_url ?? "");
  // Never auto-select Text/WhatsApp — only set when the contact explicitly picks one.
  const [textMethod, setTextMethod] = useState<"sms" | "whatsapp" | null>(initial.text_method ?? null);
  const [preferred, setPreferred] = useState<Channel | "">(initial.preferred_channel ?? "");
  const [acceptsAsks, setAcceptsAsks] = useState<boolean | null>(initial.accepts_asks ?? null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/c/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primary_email: email,
          phone_number: phone,
          linkedin_url: linkedin,
          text_method: textMethod,
          preferred_channel: preferred || null,
          accepts_asks: acceptsAsks,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Something went wrong");
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-1">
          <p className="text-lg font-medium">Thanks! 🎉</p>
          <p className="text-sm text-muted-foreground">Your contact info has been updated.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-5 space-y-4">
        <Row label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Row>
        <Row label="Phone">
          <PhoneInput initialValue={initial.phone_number ?? ""} onChange={setPhone} />
        </Row>
        <Row label="For Text Use">
          <TextMethodPicker value={textMethod} onChange={setTextMethod} />
        </Row>
        <Row label="LinkedIn">
          <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/…" />
        </Row>

        <Row label="Best way to reach you" align="start">
          <div className="space-y-1 text-sm">
            {channels.map((c) => (
              <label key={c.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="preferred"
                  checked={preferred === c.value}
                  onChange={() => setPreferred(c.value)}
                />
                {c.label}
              </label>
            ))}
            <label className="flex items-center gap-2 text-muted-foreground">
              <input type="radio" name="preferred" checked={preferred === ""} onChange={() => setPreferred("")} />
              No preference
            </label>
          </div>
        </Row>

        <Row label="Can I ping you with small asks?" align="start">
          <AskPicker value={acceptsAsks} onChange={setAcceptsAsks} includeNone={false} />
        </Row>
        {/* Subtext spans the full card width so it doesn't wrap awkwardly inside
            the narrow field column. */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>I&apos;m here to help on your journey anytime—just ask.</p>
          <p>Are you open to the occasional tactical ask from me as well?</p>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? "Saving…" : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}
