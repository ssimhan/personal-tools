"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";

export function AddTagButton() {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed");
      }
      setName("");
      setAdding(false);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (!adding) {
    return (
      <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
        <Plus className="h-3.5 w-3.5" /> Add tag
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); submit(); }
          if (e.key === "Escape") { setAdding(false); setName(""); }
        }}
        placeholder="Tag name"
        className="h-8 w-44 text-sm"
        autoFocus
        disabled={busy}
      />
      <Button size="sm" onClick={submit} disabled={busy || !name.trim()}>Add</Button>
      <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setName(""); setError(null); }} disabled={busy}>Cancel</Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
