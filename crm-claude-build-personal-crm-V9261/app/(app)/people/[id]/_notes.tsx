"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function NotesSection({ personId, notes }: { personId: string; notes: string | null }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    const res = await fetch(`/api/people/${personId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: draft }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Save failed");
      return;
    }
    setEditing(false);
    startTransition(() => router.refresh());
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Permanent notes</CardTitle>
        {!editing ? (
          <Button size="sm" variant="outline" onClick={() => { setDraft(notes ?? ""); setEditing(true); }}>Edit</Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {editing ? (
          <>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              placeholder="Important. Mention daughter's soccer. Potential Wisprd supporter. Loves blunt feedback."
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={pending}>Cancel</Button>
              <Button size="sm" onClick={save} disabled={pending}>Save</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Notes are authoritative ground truth. Saving regenerates the embedding (notes are part of the embedding input).
            </p>
          </>
        ) : notes ? (
          <p className="whitespace-pre-wrap text-sm">{notes}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No notes. These are human-authored facts the AI must respect.</p>
        )}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
