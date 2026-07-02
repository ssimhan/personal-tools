"use client";

import { useState } from "react";

export type BroadcastValue = number | null;

// A connected segmented control: 2 / 4 / 6 / 8 / None. Controlled — the caller
// owns the value and persistence. "Broadcast" = months before the next touch.
export function BroadcastPicker({
  value,
  onChange,
  disabled,
  className = "",
}: {
  value: BroadcastValue;
  onChange: (v: BroadcastValue) => void;
  disabled?: boolean;
  className?: string;
}) {
  const opts: BroadcastValue[] = [2, 4, 6, 8, null];
  return (
    <div className={`inline-flex rounded-md border overflow-hidden ${className}`}>
      {opts.map((o, i) => {
        const active = value === o;
        return (
          <button
            key={String(o)}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(o)}
            className={[
              "px-2.5 py-1 text-xs leading-none transition-colors",
              i > 0 ? "border-l" : "",
              active ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-accent",
              disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
            ].join(" ")}
          >
            {o === null ? "None" : o}
          </button>
        );
      })}
    </div>
  );
}

// Self-persisting variant: PATCHes broadcast_months and keeps optimistic local
// state, reverting on failure.
export function BroadcastControl({
  personId,
  initial,
  label = true,
}: {
  personId: string;
  initial: BroadcastValue;
  label?: boolean;
}) {
  const [value, setValue] = useState<BroadcastValue>(initial);
  const [busy, setBusy] = useState(false);

  const set = async (v: BroadcastValue) => {
    if (v === value) return;
    const prev = value;
    setValue(v);
    setBusy(true);
    try {
      const res = await fetch(`/api/people/${personId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broadcast_months: v }),
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
        <span className="text-xs text-muted-foreground" title="Months before the next touch">
          Broadcast
        </span>
      ) : null}
      <BroadcastPicker value={value} onChange={set} disabled={busy} />
    </div>
  );
}
