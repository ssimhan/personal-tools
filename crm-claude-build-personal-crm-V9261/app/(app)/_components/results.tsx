"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { SearchHit } from "@/lib/search";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatRelativeDate } from "@/lib/utils";
import { ChannelIcons } from "./channel-icons";
import { ContactEditor } from "@/app/(app)/people/[id]/_contact-editor";
import { BroadcastControl } from "./broadcast-picker";
import { LogInteractionDialog } from "./log-interaction-dialog";
import { Tags, MessageSquarePlus, Megaphone, XCircle, ChevronUp, ChevronDown, Pencil } from "lucide-react";
import { FooterCopyButton } from "./footer-copy-button";

const STORAGE_KEY = "crm:selectedIds";

type SortKey = "interaction" | "broadcast" | "broadcast_months";
type SortDir = "asc" | "desc";
type Bucket = "any" | "7" | "30" | "older" | "never";

export function Results({
  hits,
  hasMore,
  query,
  allTags,
  appBaseUrl,
}: {
  hits: SearchHit[];
  hasMore: boolean;
  query: string;
  allTags: { id: string; name: string }[];
  appBaseUrl: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Hydrate from localStorage on mount — selection survives navigation, filter
  // changes, and refresh, until the user explicitly clears or acts on it.
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSelected(new Set(JSON.parse(raw) as string[]));
    } catch {
      // ignore
    }
  }, []);
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(selected)));
    } catch {
      // ignore
    }
  }, [selected]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clear = () => setSelected(new Set());

  // Column sort + per-column recency filters live in the URL — the server does
  // the actual filtering/sorting/paging, so this scales past the loaded page.
  const sortKey = (sp.get("sort") as SortKey | null) ?? null;
  const sortDir: SortDir = sp.get("dir") === "asc" ? "asc" : "desc";
  const filterInteraction = (sp.get("li") as Bucket | null) ?? "any";
  const filterBroadcast = (sp.get("lb") as Bucket | null) ?? "any";
  const filterBroadcastMonths = sp.get("bm") ?? "any";

  const spString = sp.toString();
  const pushParams = (mut: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(spString);
    next.delete("offset"); // any filter/sort change resets to the first page
    mut(next);
    startTransition(() => router.push(`/?${next.toString()}`));
  };

  const toggleSort = (key: SortKey) =>
    pushParams((p) => {
      if (sortKey !== key) { p.set("sort", key); p.set("dir", "desc"); }
      else if (sortDir === "desc") { p.set("sort", key); p.set("dir", "asc"); }
      else { p.delete("sort"); p.delete("dir"); }
    });

  const setBucket = (param: "li" | "lb", b: Bucket) =>
    pushParams((p) => {
      if (b === "any") p.delete(param);
      else p.set(param, b);
    });

  const setBroadcastMonths = (v: string) =>
    pushParams((p) => {
      if (v === "any") p.delete("bm");
      else p.set("bm", v);
    });

  // Load-More accumulation: the server renders page 0; subsequent pages are
  // fetched client-side and appended. Reset whenever the query/filters change.
  const [extra, setExtra] = useState<SearchHit[]>([]);
  const [more, setMore] = useState(hasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => {
    setExtra([]);
    setMore(hasMore);
  }, [spString, hasMore]);

  const rows = useMemo(() => [...hits, ...extra], [hits, extra]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const p = new URLSearchParams(spString);
      p.set("offset", String(rows.length));
      const res = await fetch(`/api/search?${p.toString()}`);
      const j = await res.json();
      setExtra((e) => [...e, ...((j.hits ?? []) as SearchHit[])]);
      setMore(!!j.hasMore);
    } catch {
      // ignore — leave the button to retry
    } finally {
      setLoadingMore(false);
    }
  };

  // Modals
  const [tagOpen, setTagOpen] = useState(false);
  const [removeTagOpen, setRemoveTagOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const goToBroadcast = () => {
    if (selected.size === 0) return;
    const params = new URLSearchParams();
    Array.from(selected).forEach((id) => params.append("preset", id));
    router.push(`/broadcast?${params.toString()}`);
  };

  return (
    <div className="space-y-3">
      {selected.size > 0 ? (
        <BulkActionBar
          count={selected.size}
          onAddTag={() => setTagOpen(true)}
          onRemoveTag={() => setRemoveTagOpen(true)}
          onAddToAudience={goToBroadcast}
          onLogInteraction={() => setLogOpen(true)}
          onClear={clear}
        />
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {query
              ? <>No results above the similarity floor. Try a different phrasing.</>
              : <>No people match these filters. Use <strong>Quick Add</strong> to log your first interaction, or <strong>Import</strong> a contact list.</>}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className={`border rounded-md overflow-x-auto ${pending ? "opacity-60" : ""}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left align-bottom">
                  <th className="w-8 px-2 py-2" />
                  <th className="px-3 py-2 font-medium">Name</th>
                  <BroadcastHeader
                    active={sortKey === "broadcast_months"}
                    dir={sortDir}
                    onSort={() => toggleSort("broadcast_months")}
                    value={filterBroadcastMonths}
                    onValue={setBroadcastMonths}
                  />
                  <DateHeader
                    label="Last interaction"
                    active={sortKey === "interaction"}
                    dir={sortDir}
                    onSort={() => toggleSort("interaction")}
                    bucket={filterInteraction}
                    onBucket={(b) => setBucket("li", b)}
                  />
                  <DateHeader
                    label="Last broadcast"
                    active={sortKey === "broadcast"}
                    dir={sortDir}
                    onSort={() => toggleSort("broadcast")}
                    bucket={filterBroadcast}
                    onBucket={(b) => setBucket("lb", b)}
                  />
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <ResultRow key={h.id} hit={h} checked={selected.has(h.id)} onToggle={() => toggle(h.id)} appBaseUrl={appBaseUrl} />
                ))}
              </tbody>
            </table>
          </div>
          {more ? (
            <div className="flex justify-center">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </>
      )}

      <AddTagDialog
        open={tagOpen}
        onClose={() => setTagOpen(false)}
        allTags={allTags}
        personIds={Array.from(selected)}
        onDone={() => { setTagOpen(false); router.refresh(); }}
      />

      <RemoveTagDialog
        open={removeTagOpen}
        onClose={() => setRemoveTagOpen(false)}
        allTags={allTags}
        personIds={Array.from(selected)}
        onDone={() => { setRemoveTagOpen(false); router.refresh(); }}
      />

      <LogInteractionDialog
        open={logOpen}
        onClose={() => setLogOpen(false)}
        personIds={Array.from(selected)}
        onDone={() => { setLogOpen(false); router.refresh(); }}
      />
    </div>
  );
}

function DateHeader({
  label, active, dir, onSort, bucket, onBucket,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onSort: () => void;
  bucket: Bucket;
  onBucket: (b: Bucket) => void;
}) {
  return (
    <th className="px-3 py-2 font-medium whitespace-nowrap">
      <button onClick={onSort} className="inline-flex items-center gap-1 hover:underline">
        {label}
        {active ? (dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
      </button>
      <select
        value={bucket}
        onChange={(e) => onBucket(e.target.value as Bucket)}
        className="mt-1 block h-6 rounded border bg-transparent px-1 text-xs font-normal text-muted-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <option value="any">Any time</option>
        <option value="7">≤ 7 days</option>
        <option value="30">≤ 30 days</option>
        <option value="older">&gt; 30 days</option>
        <option value="never">Never</option>
      </select>
    </th>
  );
}

function BroadcastHeader({
  active, dir, onSort, value, onValue,
}: {
  active: boolean;
  dir: SortDir;
  onSort: () => void;
  value: string;
  onValue: (v: string) => void;
}) {
  return (
    <th className="px-3 py-2 font-medium whitespace-nowrap">
      <button
        onClick={onSort}
        className="inline-flex items-center gap-1 hover:underline"
        title="Months before the next touch"
      >
        Frequency
        {active ? (dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
      </button>
      <select
        value={value}
        onChange={(e) => onValue(e.target.value)}
        className="mt-1 block h-6 rounded border bg-transparent px-1 text-xs font-normal text-muted-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <option value="any">Any</option>
        <option value="2">2 mo</option>
        <option value="4">4 mo</option>
        <option value="6">6 mo</option>
        <option value="8">8 mo</option>
        <option value="none">None</option>
      </select>
    </th>
  );
}

function ResultRow({ hit, checked, onToggle, appBaseUrl }: { hit: SearchHit; checked: boolean; onToggle: () => void; appBaseUrl: string }) {
  const router = useRouter();
  const [editorOpen, setEditorOpen] = useState(false);
  return (
    <tr className={`border-b last:border-b-0 hover:bg-accent/30 transition-colors ${checked ? "bg-primary/5" : ""}`}>
      <td className="px-2 py-2 align-top">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-1 cursor-pointer"
          aria-label={`Select ${hit.full_name}`}
        />
      </td>
      <td className="px-3 py-2 align-top">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setEditorOpen(true)}
            title="Edit communication channels"
            aria-label={`Edit contact info for ${hit.full_name}`}
            className="text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <FooterCopyButton person={hit} appBaseUrl={appBaseUrl} />
          <Link href={`/people/${hit.id}`} className="font-medium hover:underline">
            {hit.full_name}
          </Link>
          <ChannelIcons p={hit} onEdit={() => setEditorOpen(true)} />
          {hit.matched_via === "semantic" && hit.similarity != null ? (
            <span className="text-xs text-muted-foreground">{Math.round(hit.similarity * 100)}%</span>
          ) : null}
          <ContactEditor
            personId={hit.id}
            open={editorOpen}
            onOpenChange={(o) => {
              setEditorOpen(o);
              if (!o) router.refresh(); // pick up edits made in the dialog
            }}
            hideTrigger
            initial={{
              primary_email: hit.primary_email,
              secondary_emails: hit.secondary_emails,
              linkedin_url: hit.linkedin_url,
              phone_number: hit.phone_number,
              slack_channel: hit.slack_channel,
              preferred_channel: (hit.preferred_channel as "email" | "linkedin" | "phone" | "slack" | "text" | null) ?? null,
              text_method: (hit.text_method as "sms" | "whatsapp" | null) ?? null,
            }}
          />
        </div>
      </td>
      <td className="px-3 py-2 align-top whitespace-nowrap">
        <BroadcastControl personId={hit.id} initial={hit.broadcast_months} label={false} />
      </td>
      <td className="px-3 py-2 align-top whitespace-nowrap text-muted-foreground">
        {formatRelativeDate(hit.last_interaction_at)}
      </td>
      <td className="px-3 py-2 align-top whitespace-nowrap text-muted-foreground">
        {formatRelativeDate(hit.last_broadcast_at)}
      </td>
    </tr>
  );
}

function BulkActionBar({
  count,
  onAddTag,
  onRemoveTag,
  onAddToAudience,
  onLogInteraction,
  onClear,
}: {
  count: number;
  onAddTag: () => void;
  onRemoveTag: () => void;
  onAddToAudience: () => void;
  onLogInteraction: () => void;
  onClear: () => void;
}) {
  return (
    <div className="sticky top-14 z-10 bg-card border rounded-md p-2 flex flex-wrap items-center gap-2 text-sm shadow-sm">
      <span className="font-medium px-1">{count} selected</span>
      <Button size="sm" variant="outline" onClick={onAddTag}>
        <Tags className="h-3.5 w-3.5" /> Add tag
      </Button>
      <Button size="sm" variant="outline" onClick={onRemoveTag}>
        <Tags className="h-3.5 w-3.5" /> Remove tag
      </Button>
      <Button size="sm" variant="outline" onClick={onAddToAudience}>
        <Megaphone className="h-3.5 w-3.5" /> Add to broadcast audience
      </Button>
      <Button size="sm" variant="outline" onClick={onLogInteraction}>
        <MessageSquarePlus className="h-3.5 w-3.5" /> Log interaction
      </Button>
      <Button size="sm" variant="ghost" className="ml-auto" onClick={onClear}>
        <XCircle className="h-3.5 w-3.5" /> Clear selection
      </Button>
    </div>
  );
}

function AddTagDialog({
  open, onClose, allTags, personIds, onDone,
}: {
  open: boolean;
  onClose: () => void;
  allTags: { id: string; name: string }[];
  personIds: string[];
  onDone: () => void;
}) {
  const [tagName, setTagName] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = async (name: string) => {
    if (!name.trim() || personIds.length === 0) return;
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: personIds.length });
    try {
      // Fan-out — small N, sequential is fine and avoids hammering rate limits.
      for (let i = 0; i < personIds.length; i++) {
        const res = await fetch(`/api/people/${personIds[i]}/tags`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        });
        if (!res.ok && res.status !== 409) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `Failed at person ${i + 1}/${personIds.length}`);
        }
        setProgress({ done: i + 1, total: personIds.length });
      }
      onDone();
      setTagName("");
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
          <DialogTitle>Add tag to {personIds.length} {personIds.length === 1 ? "contact" : "contacts"}</DialogTitle>
        </DialogHeader>
        {allTags.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Existing tags — click to apply:</p>
            <div className="flex flex-wrap gap-1">
              {allTags.map((t) => (
                <button
                  key={t.id}
                  onClick={() => apply(t.name)}
                  disabled={busy}
                  className="rounded-md border bg-secondary text-secondary-foreground px-2 py-0.5 text-xs hover:bg-primary hover:text-primary-foreground"
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <form
          onSubmit={(e) => { e.preventDefault(); apply(tagName); }}
          className="flex gap-2"
        >
          <Input
            placeholder="Or type a new tag name…"
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            disabled={busy}
          />
          <Button type="submit" disabled={busy || !tagName.trim()}>Apply</Button>
        </form>
        {progress ? <p className="text-xs text-muted-foreground">Tagging… {progress.done}/{progress.total}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}

function RemoveTagDialog({
  open, onClose, allTags, personIds, onDone,
}: {
  open: boolean;
  onClose: () => void;
  allTags: { id: string; name: string }[];
  personIds: string[];
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = async (tag: { id: string; name: string }) => {
    if (personIds.length === 0) return;
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: personIds.length });
    try {
      // Removing a tag a person doesn't have is a harmless no-op server-side.
      for (let i = 0; i < personIds.length; i++) {
        const res = await fetch(`/api/people/${personIds[i]}/tags?tag_id=${tag.id}`, { method: "DELETE" });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `Failed at person ${i + 1}/${personIds.length}`);
        }
        setProgress({ done: i + 1, total: personIds.length });
      }
      onDone();
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
          <DialogTitle>Remove tag from {personIds.length} {personIds.length === 1 ? "contact" : "contacts"}</DialogTitle>
        </DialogHeader>
        {allTags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tags exist.</p>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Click a tag to remove it from all selected contacts:</p>
            <div className="flex flex-wrap gap-1">
              {allTags.map((t) => (
                <button
                  key={t.id}
                  onClick={() => remove(t)}
                  disabled={busy}
                  className="rounded-md border bg-secondary text-secondary-foreground px-2 py-0.5 text-xs hover:bg-destructive hover:text-white"
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {progress ? <p className="text-xs text-muted-foreground">Removing… {progress.done}/{progress.total}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}

