"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FeedRow } from "@/lib/feed";
import { Card, CardContent } from "@/components/ui/card";
import { ChannelIcons } from "./channel-icons";
import { ContactEditor } from "@/app/(app)/people/[id]/_contact-editor";
import { BroadcastControl } from "./broadcast-picker";
import { LogInteractionDialog } from "./log-interaction-dialog";
import { ThumbsUp, ThumbsDown, Check, Pause, Pencil } from "lucide-react";
import { FooterCopyButton } from "./footer-copy-button";

export function FeedList({
  initialItems,
  allTags,
  appBaseUrl,
}: {
  initialItems: FeedRow[];
  allTags: { id: string; name: string }[];
  appBaseUrl: string;
}) {
  const router = useRouter();
  // Optimistic-hide set: ids the user has acted on (✅ or ▶️). Local state so
  // the row vanishes immediately. We also keep an inline value override so 👍/👎
  // shows live without a refetch.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [values, setValues] = useState<Map<string, number>>(new Map());
  const [errorFor, setErrorFor] = useState<Map<string, string>>(new Map());
  const [logTargetId, setLogTargetId] = useState<string | null>(null);

  const visible = initialItems.filter((r) => !hidden.has(r.id));

  const adjustValue = async (row: FeedRow, kind: "up" | "down") => {
    const prev = values.get(row.id) ?? row.value;
    const next = prev + (kind === "up" ? 1 : -1);
    setValues((m) => new Map(m).set(row.id, next));
    setErrorFor((m) => { const n = new Map(m); n.delete(row.id); return n; });
    try {
      const res = await fetch(`/api/people/${row.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setValues((m) => new Map(m).set(row.id, prev));
      setErrorFor((m) => new Map(m).set(row.id, "Save failed"));
    }
  };

  const snooze = async (row: FeedRow) => {
    setHidden((s) => new Set(s).add(row.id));
    try {
      const res = await fetch(`/api/people/${row.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "snooze" }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Pop the row back so the user notices.
      setHidden((s) => { const n = new Set(s); n.delete(row.id); return n; });
      setErrorFor((m) => new Map(m).set(row.id, "Snooze failed"));
    }
  };

  const onLogDone = () => {
    if (logTargetId) setHidden((s) => new Set(s).add(logTargetId));
    setLogTargetId(null);
    router.refresh(); // re-pull the feed (the contact's last_interaction_at moved)
  };

  if (visible.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          All caught up — no one&apos;s overdue. Set a <strong>Frequency</strong> on contacts you want
          this view to track.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {visible.map((row) => (
          <FeedRowView
            key={row.id}
            row={row}
            valueOverride={values.get(row.id)}
            error={errorFor.get(row.id) ?? null}
            appBaseUrl={appBaseUrl}
            onUp={() => adjustValue(row, "up")}
            onDown={() => adjustValue(row, "down")}
            onSnooze={() => snooze(row)}
            onAction={() => setLogTargetId(row.id)}
          />
        ))}
      </div>

      <LogInteractionDialog
        open={logTargetId !== null}
        onClose={() => setLogTargetId(null)}
        personIds={logTargetId ? [logTargetId] : []}
        onDone={onLogDone}
      />
    </>
  );
}

function FeedRowView({
  row, valueOverride, error, appBaseUrl, onUp, onDown, onSnooze, onAction,
}: {
  row: FeedRow;
  valueOverride: number | undefined;
  error: string | null;
  appBaseUrl: string;
  onUp: () => void;
  onDown: () => void;
  onSnooze: () => void;
  onAction: () => void;
}) {
  const router = useRouter();
  const [editorOpen, setEditorOpen] = useState(false);
  const value = valueOverride ?? row.value;
  const overdueLabel =
    row.last_interaction_at == null
      ? "Never contacted"
      : `${row.days_overdue} day${row.days_overdue === 1 ? "" : "s"} overdue`;

  return (
    <div className="border rounded-md p-3 flex flex-wrap items-center gap-3 text-sm hover:bg-accent/20 transition-colors">
      <button
        type="button"
        onClick={() => setEditorOpen(true)}
        title="Edit communication channels"
        aria-label={`Edit contact info for ${row.full_name}`}
        className="text-muted-foreground hover:text-foreground"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      <FooterCopyButton person={row} appBaseUrl={appBaseUrl} />

      <Link href={`/people/${row.id}`} className="font-medium hover:underline">
        {row.full_name}
      </Link>

      <ChannelIcons p={row} onEdit={() => setEditorOpen(true)} />

      <BroadcastControl personId={row.id} initial={row.broadcast_months} label={false} />

      <span className="text-xs text-muted-foreground whitespace-nowrap">{overdueLabel}</span>

      {value !== 0 ? (
        <span
          className={`text-xs rounded px-1.5 py-0.5 ${value > 0 ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}
          title="Running thumbs tally"
        >
          {value > 0 ? `+${value}` : value}
        </span>
      ) : null}

      {error ? <span className="text-xs text-destructive">{error}</span> : null}

      <div className="ml-auto flex items-center gap-1">
        <FeedButton onClick={onUp} title="Increase priority" label="thumbs up">
          <ThumbsUp className="h-4 w-4" />
        </FeedButton>
        <FeedButton onClick={onDown} title="Decrease priority" label="thumbs down">
          <ThumbsDown className="h-4 w-4" />
        </FeedButton>
        <FeedButton onClick={onAction} title="I took action — log it" label="took action">
          <Check className="h-4 w-4" />
        </FeedButton>
        <FeedButton onClick={onSnooze} title="Snooze 30 days" label="snooze">
          <Pause className="h-4 w-4" />
        </FeedButton>
      </div>

      <ContactEditor
        personId={row.id}
        open={editorOpen}
        onOpenChange={(o) => {
          setEditorOpen(o);
          if (!o) router.refresh();
        }}
        hideTrigger
        initial={{
          primary_email: row.primary_email,
          secondary_emails: row.secondary_emails,
          linkedin_url: row.linkedin_url,
          phone_number: row.phone_number,
          slack_channel: row.slack_channel,
          preferred_channel: (row.preferred_channel as "email" | "linkedin" | "phone" | "slack" | "text" | null) ?? null,
          text_method: (row.text_method as "sms" | "whatsapp" | null) ?? null,
        }}
      />
    </div>
  );
}

function FeedButton({
  onClick, title, label, children,
}: {
  onClick: () => void;
  title: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={label}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
    >
      {children}
    </button>
  );
}
