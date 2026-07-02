"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  personId: string;
  summary: string | null;
  previousSummary: string | null;
}

export function SummarySection({ personId, summary, previousSummary }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(summary ?? "");
  const [showPrev, setShowPrev] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    const res = await fetch(`/api/people/${personId}/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary: draft }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Save failed");
      return;
    }
    setEditing(false);
    startTransition(() => router.refresh());
  };

  const revert = async () => {
    setError(null);
    const res = await fetch(`/api/people/${personId}/summary/revert`, { method: "POST" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Revert failed");
      return;
    }
    setShowPrev(false);
    startTransition(() => router.refresh());
  };

  const len = draft.length;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Relationship summary</CardTitle>
        <div className="flex items-center gap-2">
          {previousSummary ? (
            <Button size="sm" variant="outline" onClick={() => setShowPrev((v) => !v)}>
              {showPrev ? "Hide prior" : "View prior"}
            </Button>
          ) : null}
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => { setDraft(summary ?? ""); setEditing(true); }}>
              Edit
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {editing ? (
          <>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 1000))}
              rows={6}
            />
            <div className="flex items-center justify-between">
              <span className={`text-xs ${len > 900 ? "text-destructive" : "text-muted-foreground"}`}>{len} / 1000</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={pending}>Cancel</Button>
                <Button size="sm" onClick={save} disabled={pending}>Save</Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Saving regenerates the embedding from this text. The current summary becomes the prior snapshot.
            </p>
          </>
        ) : summary ? (
          <p className="whitespace-pre-wrap text-sm">{summary}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No summary yet. Log an interaction and the AI will generate one — or click Edit to write one manually.</p>
        )}

        {showPrev && previousSummary ? (
          <div className="border rounded-md p-3 bg-muted/30 space-y-2">
            <div className="flex items-center justify-between">
              <Badge>Prior snapshot</Badge>
              <Button size="sm" variant="outline" onClick={revert} disabled={pending}>Revert to this</Button>
            </div>
            <p className="whitespace-pre-wrap text-sm">{previousSummary}</p>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
