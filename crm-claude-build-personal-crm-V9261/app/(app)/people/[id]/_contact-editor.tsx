"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Pencil, X, Plus } from "lucide-react";
import { TextMethodPicker } from "@/app/(app)/_components/ask-picker";
import { PhoneInput } from "@/app/(app)/_components/phone-input";

type Channel = "email" | "linkedin" | "phone" | "slack" | "text";

interface Props {
  personId: string;
  initial: {
    primary_email: string | null;
    secondary_emails: string[] | null;
    linkedin_url: string | null;
    phone_number: string | null;
    slack_channel: string | null;
    preferred_channel: Channel | null;
    text_method: "sms" | "whatsapp" | null;
  };
  // Controlled mode: when `open`/`onOpenChange` are provided the dialog is
  // driven by the parent and the built-in trigger button is hidden. Used by
  // the search rows, which open the editor when a missing channel is clicked.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

// One-stop contact info editor. Emails are a multi-row list (first row =
// primary). Each row has a clear-X to its right.
//
// On save:
//   - Emails: diff the initial list vs the current list. Add new ones, then
//     make_primary on the desired top, then delete removed ones (in that
//     order so the server's "delete-primary auto-promotes a secondary"
//     fallback doesn't fight our intent).
//   - Everything else: one PATCH including preferred_channel.
export function ContactEditor({ personId, initial, open: openProp, onOpenChange, hideTrigger }: Props) {
  const router = useRouter();
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const setOpen = (o: boolean) => {
    if (controlled) onOpenChange?.(o);
    else setOpenState(o);
  };

  const initialEmailList = [
    initial.primary_email?.trim().toLowerCase(),
    ...(initial.secondary_emails ?? []).map((e) => e.trim().toLowerCase()),
  ].filter((e): e is string => !!e);

  const [emails, setEmails] = useState<string[]>(initialEmailList.length ? initialEmailList : [""]);
  const [linkedin, setLinkedin] = useState(initial.linkedin_url ?? "");
  const [phone, setPhone] = useState(initial.phone_number ?? "");
  const [slack, setSlack] = useState(initial.slack_channel ?? "");
  const [textMethod, setTextMethod] = useState<"sms" | "whatsapp" | null>(initial.text_method ?? null);
  const [preferred, setPreferred] = useState<Channel | "">(initial.preferred_channel ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  const setEmailAt = (i: number, value: string) =>
    setEmails((arr) => arr.map((e, j) => (j === i ? value : e)));
  const removeEmailAt = (i: number) =>
    setEmails((arr) => {
      const next = arr.filter((_, j) => j !== i);
      return next.length === 0 ? [""] : next;
    });
  const addEmail = () => setEmails((arr) => [...arr, ""]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      // 1. Email diff
      const finalEmails = emails.map((e) => e.trim().toLowerCase()).filter(Boolean);
      const initialSet = new Set(initialEmailList);
      const finalSet = new Set(finalEmails);
      const toAdd = finalEmails.filter((e) => !initialSet.has(e));
      const toRemove = [...initialSet].filter((e) => !finalSet.has(e));
      const desiredPrimary = finalEmails[0] ?? null;
      const currentPrimary = initial.primary_email?.toLowerCase() ?? null;

      for (const e of toAdd) {
        const res = await fetch(`/api/people/${personId}/emails`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add", email: e }),
        });
        // 409 = already present, idempotent — ignore. Other errors throw.
        if (!res.ok && res.status !== 409) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "email add failed");
        }
      }

      if (desiredPrimary && desiredPrimary !== currentPrimary) {
        const res = await fetch(`/api/people/${personId}/emails`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "make_primary", email: desiredPrimary }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "make_primary failed");
        }
      }

      for (const e of toRemove) {
        const res = await fetch(`/api/people/${personId}/emails`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", email: e }),
        });
        if (!res.ok && res.status !== 404) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "email delete failed");
        }
      }

      // 2. Everything else — single PATCH
      const patch: Record<string, string | null> = {
        linkedin_url: linkedin.trim() || null,
        phone_number: phone.trim() || null,
        slack_channel: slack.trim() || null,
        preferred_channel: preferred || null,
        text_method: textMethod,
      };
      const res = await fetch(`/api/people/${personId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Save failed");
      }

      setOpen(false);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Render helpers — keep rows visually aligned regardless of which control they contain.
  const radio = (key: Channel) => (
    <input
      type="radio"
      name="preferred"
      checked={preferred === key}
      onChange={() => setPreferred(key)}
      className="cursor-pointer"
    />
  );

  const clearBtn = (onClear: () => void) => (
    <button
      type="button"
      onClick={onClear}
      className="text-muted-foreground hover:text-destructive shrink-0 p-1"
      title="Clear"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {hideTrigger ? null : (
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <Pencil className="h-3.5 w-3.5" />
            Update contact info
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Contact info</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 pt-2 pb-1 text-xs text-muted-foreground">
            <span className="w-8 shrink-0">Pref</span>
            <span className="w-20 shrink-0">Channel</span>
            <span className="flex-1">Value</span>
          </div>

          {/* Emails — multi-row, first is primary */}
          {emails.map((value, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-8 shrink-0 flex justify-start">{i === 0 ? radio("email") : null}</span>
              <Label className="w-20 shrink-0 text-xs">{i === 0 ? "Email" : ""}</Label>
              <Input
                value={value}
                onChange={(e) => setEmailAt(i, e.target.value)}
                placeholder="name@company.com"
                className="flex-1"
                type="email"
              />
              {clearBtn(() => removeEmailAt(i))}
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="w-8 shrink-0" />
            <span className="w-20 shrink-0" />
            <button
              type="button"
              onClick={addEmail}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Add email
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-8 shrink-0 flex justify-start">{radio("linkedin")}</span>
            <Label className="w-20 shrink-0 text-xs">LinkedIn</Label>
            <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/…" className="flex-1" />
            {clearBtn(() => setLinkedin(""))}
          </div>

          <div className="flex items-center gap-2">
            <span className="w-8 shrink-0 flex justify-start">{radio("phone")}</span>
            <Label className="w-20 shrink-0 text-xs">Phone</Label>
            <div className="flex-1">
              <PhoneInput initialValue={initial.phone_number ?? ""} onChange={setPhone} />
            </div>
            {clearBtn(() => setPhone(""))}
          </div>

          <div className="flex items-center gap-2">
            <span className="w-8 shrink-0 flex justify-start">{radio("slack")}</span>
            <Label className="w-20 shrink-0 text-xs">Slack</Label>
            <Input value={slack} onChange={(e) => setSlack(e.target.value)} placeholder="https://workspace.slack.com/…" className="flex-1" />
            {clearBtn(() => setSlack(""))}
          </div>

          {/* Text uses the Phone number; the picker is unset by default and
              only set when the user explicitly picks Text or WhatsApp. */}
          <div className="flex items-center gap-2">
            <span className="w-8 shrink-0 flex justify-start">{radio("text")}</span>
            <Label className="w-20 shrink-0 text-xs">Text</Label>
            <div className="flex-1" title="Texting uses the Phone number">
              <TextMethodPicker value={textMethod} onChange={setTextMethod} />
            </div>
            <span className="w-5 shrink-0" />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <span className="w-8 shrink-0 flex justify-start">
              <input
                type="radio"
                name="preferred"
                checked={preferred === ""}
                onChange={() => setPreferred("")}
                className="cursor-pointer"
              />
            </span>
            <Label className="w-20 shrink-0 text-xs">None</Label>
            <span className="text-xs text-muted-foreground">No preferred channel</span>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving || pending}>Cancel</Button>
          <Button onClick={save} disabled={saving || pending}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
