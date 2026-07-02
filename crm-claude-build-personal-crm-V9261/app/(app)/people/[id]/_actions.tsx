"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Merge } from "lucide-react";

interface Match {
  id: string;
  full_name: string;
  primary_email: string | null;
}

export function PersonActions({ personId, personName }: { personId: string; personName: string }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const doDelete = async () => {
    const res = await fetch(`/api/people/${personId}`, { method: "DELETE" });
    if (res.ok) {
      startTransition(() => {
        router.push("/");
        router.refresh();
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm"><Merge className="h-4 w-4" />Merge</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge into {personName}</DialogTitle>
          </DialogHeader>
          <MergeInner
            personId={personId}
            onDone={() => {
              setMergeOpen(false);
              startTransition(() => router.refresh());
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />Delete
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {personName}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This deletes the person and all their interactions. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={doDelete} disabled={pending}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MergeInner({ personId, onDone }: { personId: string; onDone: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Match[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const j = await res.json();
    setSearching(false);
    if (res.ok) {
      const filtered = (j.hits as Match[]).filter((h) => h.id !== personId);
      setResults(filtered);
    }
  };

  const submit = async () => {
    if (!selectedId) return;
    setMerging(true);
    setStatus("Merging…");
    const res = await fetch(`/api/people/${personId}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otherId: selectedId }),
    });
    const j = await res.json();
    setMerging(false);
    if (!res.ok) {
      setStatus(j.error ?? "merge failed");
      return;
    }
    onDone();
  };

  const selected = results.find((r) => r.id === selectedId);

  if (confirmStep && selected) {
    return (
      <div className="space-y-3 text-sm">
        <p>
          The interactions, tags, and contact info from <strong>{selected.full_name}</strong> will be moved into
          this person. The other record will be <strong>deleted</strong>. This can&apos;t be undone.
        </p>
        {status ? <p className="text-muted-foreground">{status}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmStep(false)} disabled={merging}>Back</Button>
          <Button variant="destructive" onClick={submit} disabled={merging}>Merge and delete</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-muted-foreground">
        Find the duplicate person to merge into this one. Their interactions and tags move here; their record is deleted.
      </p>
      <form
        onSubmit={(e) => { e.preventDefault(); runSearch(); }}
        className="flex gap-2"
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, or anything…"
          autoFocus
        />
        <Button type="submit" disabled={searching}>{searching ? "…" : "Search"}</Button>
      </form>
      {results.length > 0 ? (
        <div className="border rounded-md divide-y max-h-80 overflow-y-auto">
          {results.map((r) => (
            <label key={r.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent">
              <input
                type="radio"
                name="merge-target"
                checked={selectedId === r.id}
                onChange={() => setSelectedId(r.id)}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{r.full_name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {r.primary_email ?? ""}
                </div>
              </div>
            </label>
          ))}
        </div>
      ) : query && !searching ? (
        <p className="text-xs text-muted-foreground">No matches.</p>
      ) : null}
      <div className="flex justify-end">
        <Button disabled={!selectedId} onClick={() => setConfirmStep(true)}>Next →</Button>
      </div>
    </div>
  );
}
