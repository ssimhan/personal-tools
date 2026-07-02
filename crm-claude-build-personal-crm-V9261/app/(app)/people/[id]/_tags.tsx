"use client";

import { useState } from "react";

interface Tag { id: string; name: string }

// Click-to-toggle chips for every tag in the CRM (active = on this person).
// Tags can only be CREATED in Admin — here you just assign/unassign existing ones.
export function TagsSection({ personId, allTags, personTags }: { personId: string; allTags: Tag[]; personTags: Tag[] }) {
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set(personTags.map((t) => t.id)));
  const [busyId, setBusyId] = useState<string | null>(null);

  // Merge defends against a person tag somehow missing from allTags.
  const byId = new Map<string, Tag>();
  for (const t of allTags) byId.set(t.id, t);
  for (const t of personTags) if (!byId.has(t.id)) byId.set(t.id, t);
  const merged = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));

  const toggle = async (t: Tag) => {
    const wasActive = activeIds.has(t.id);
    setBusyId(t.id);
    setActiveIds((s) => {
      const n = new Set(s);
      if (wasActive) n.delete(t.id); else n.add(t.id);
      return n;
    });
    try {
      const res = wasActive
        ? await fetch(`/api/people/${personId}/tags?tag_id=${t.id}`, { method: "DELETE" })
        : await fetch(`/api/people/${personId}/tags`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: t.name }),
          });
      if (!res.ok && res.status !== 409) throw new Error("toggle failed");
    } catch {
      setActiveIds((s) => {
        const n = new Set(s);
        if (wasActive) n.add(t.id); else n.delete(t.id);
        return n;
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-xs text-muted-foreground">Tags:</span>
      {merged.length === 0 ? (
        <span className="text-xs text-muted-foreground">No tags yet — create tags in Admin.</span>
      ) : (
        merged.map((t) => {
          const active = activeIds.has(t.id);
          return (
            <button
              key={t.id}
              onClick={() => toggle(t)}
              disabled={busyId === t.id}
              className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-secondary-foreground border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              {t.name}
            </button>
          );
        })
      )}
    </div>
  );
}
