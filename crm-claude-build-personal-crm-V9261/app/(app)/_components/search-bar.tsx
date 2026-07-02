"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";

interface Props {
  defaultQuery: string;
  tags: { id: string; name: string }[];
  selectedTagIds: string[];
  acceptsAsksYes: boolean;
}

export function SearchBar({ defaultQuery, tags, selectedTagIds, acceptsAsksYes }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(defaultQuery);
  const [pending, startTransition] = useTransition();

  const update = (mut: (params: URLSearchParams) => void) => {
    const next = new URLSearchParams(sp.toString());
    mut(next);
    startTransition(() => router.push(`/?${next.toString()}`));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    update((p) => {
      if (q.trim()) p.set("q", q.trim());
      else p.delete("q");
    });
  };

  const toggleTag = (id: string) => {
    update((p) => {
      const current = p.getAll("tag");
      p.delete("tag");
      const next = current.includes(id) ? current.filter((t) => t !== id) : [...current, id];
      next.forEach((t) => p.append("tag", t));
    });
  };

  const toggleAcceptsAsks = () => {
    update((p) => {
      if (acceptsAsksYes) p.delete("aa");
      else p.set("aa", "1");
      p.delete("offset");
    });
  };

  const clearQuery = () => {
    setQ("");
    update((p) => {
      p.delete("q");
      p.delete("offset"); // back to the first page
    });
  };

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Try: "revops leaders in sf" or "founders interested in community"'
            className="pl-9 pr-9"
          />
          {q ? (
            <button
              type="button"
              onClick={clearQuery}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <Button type="submit" disabled={pending}>Search</Button>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground text-xs">Tags:</span>
        {tags.length === 0 ? <span className="text-xs text-muted-foreground">none yet</span> : null}
        {tags.map((t) => {
          const active = selectedTagIds.includes(t.id);
          return (
            <button
              key={t.id}
              onClick={() => toggleTag(t.id)}
              className={`rounded-md border px-2 py-0.5 text-xs ${active ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-secondary-foreground"}`}
            >
              {t.name}
            </button>
          );
        })}
        {selectedTagIds.length ? (
          <Badge className="ml-auto">filter-then-rank active</Badge>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          onClick={toggleAcceptsAsks}
          className={`rounded-md border px-2 py-0.5 text-xs ${acceptsAsksYes ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-secondary-foreground"}`}
          title="Show only contacts who said Yes to small asks"
        >
          Open to asks
        </button>
      </div>
    </div>
  );
}
