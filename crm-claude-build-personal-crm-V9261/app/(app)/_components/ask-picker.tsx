"use client";

import { useState } from "react";

export type AskValue = boolean | null;

// Connected segmented control: [ Yes | No | None ]. Controlled — caller owns
// the value and persistence. Visual style mirrors BroadcastPicker.
export function AskPicker({
  value,
  onChange,
  disabled,
  includeNone = true,
  className = "",
}: {
  value: AskValue;
  onChange: (v: AskValue) => void;
  disabled?: boolean;
  includeNone?: boolean;
  className?: string;
}) {
  const opts: { v: AskValue; label: string }[] = [
    { v: true, label: "Yes" },
    { v: false, label: "No" },
    ...(includeNone ? [{ v: null as AskValue, label: "None" }] : []),
  ];
  return (
    <div className={`inline-flex rounded-md border overflow-hidden ${className}`}>
      {opts.map((o, i) => {
        const active = value === o.v;
        return (
          <button
            key={String(o.v)}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(o.v)}
            className={[
              "px-2.5 py-1 text-xs leading-none transition-colors",
              i > 0 ? "border-l" : "",
              active ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-accent",
              disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Self-persisting variant for the CRM Person page / extension. Mirrors
// BroadcastControl's PATCH + optimistic + rollback pattern.
export function AskControl({
  personId,
  initial,
  label = true,
}: {
  personId: string;
  initial: AskValue;
  label?: boolean;
}) {
  const [value, setValue] = useState<AskValue>(initial);
  const [busy, setBusy] = useState(false);

  const set = async (v: AskValue) => {
    if (v === value) return;
    const prev = value;
    setValue(v);
    setBusy(true);
    try {
      const res = await fetch(`/api/people/${personId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepts_asks: v }),
      });
      if (!res.ok) throw new Error("save failed");
    } catch {
      setValue(prev);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      {label ? (
        <span className="text-xs text-muted-foreground" title="Has the contact opted in to small asks?">
          Ask
        </span>
      ) : null}
      <AskPicker value={value} onChange={set} disabled={busy} />
    </div>
  );
}

// Connected segmented control: [ Text | WhatsApp ]. Controlled — caller owns
// the value (which can be null) and persistence. Used on the public form and
// in the CRM contact editor; never auto-selects.
export type TextMethodValue = "sms" | "whatsapp" | null;

export function TextMethodPicker({
  value,
  onChange,
  disabled,
  className = "",
}: {
  value: TextMethodValue;
  onChange: (v: TextMethodValue) => void;
  disabled?: boolean;
  className?: string;
}) {
  const opts: { v: TextMethodValue; label: string }[] = [
    { v: "sms", label: "Text" },
    { v: "whatsapp", label: "WhatsApp" },
  ];
  return (
    <div className={`inline-flex rounded-md border overflow-hidden ${className}`}>
      {opts.map((o, i) => {
        const active = value === o.v;
        return (
          <button
            key={String(o.v)}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(active ? null : o.v)} // click again to clear
            className={[
              "px-2.5 py-1 text-xs leading-none transition-colors",
              i > 0 ? "border-l" : "",
              active ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-accent",
              disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
