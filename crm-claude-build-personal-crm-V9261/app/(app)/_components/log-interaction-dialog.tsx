"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Shared modal for logging a manual_note interaction against one or more
// people. Used by Search bulk actions AND by the Feed's "Took action" button.
// Each person logs sequentially through /api/quick-add (which runs the full
// pipeline: summary regen, embedding refresh, etc.).
export function LogInteractionDialog({
  open, onClose, personIds, onDone,
}: {
  open: boolean;
  onClose: () => void;
  personIds: string[];
  onDone: () => void;
}) {
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!content.trim() || personIds.length === 0) return;
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: personIds.length });
    try {
      for (let i = 0; i < personIds.length; i++) {
        const fd = new FormData();
        fd.set("mode", "text");
        fd.set("content", content);
        fd.set("force_person_id", personIds[i]);
        const res = await fetch("/api/quick-add", { method: "POST", body: fd });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `Failed at person ${i + 1}/${personIds.length}`);
        }
        setProgress({ done: i + 1, total: personIds.length });
      }
      onDone();
      setContent("");
      setProgress(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log interaction for {personIds.length} {personIds.length === 1 ? "contact" : "contacts"}</DialogTitle>
        </DialogHeader>
        {personIds.length > 1 ? (
          <p className="text-xs text-muted-foreground">
            The same note will be appended to each selected person, and each summary regenerates.
          </p>
        ) : null}
        <Textarea
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What happened?"
          disabled={busy}
        />
        {progress ? <p className="text-xs text-muted-foreground">Logging… {progress.done}/{progress.total}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !content.trim()}>
            {busy ? "Logging…" : personIds.length === 1 ? "Log" : "Log to all"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
