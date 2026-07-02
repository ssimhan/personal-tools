"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RichTextEditor } from "../_components/rich-text-editor";

type SortBy = "relevance" | "broadcast_oldest" | "broadcast_newest";

interface AudienceMember {
  id: string;
  full_name: string;
  primary_email: string | null;
  has_summary: boolean;
  last_broadcast_at: string | null;
}

function lastBroadcastLabel(iso: string | null): string {
  if (!iso) return "never";
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

interface Draft {
  personId: string;
  to: string;
  fullName: string;
  intro: string;
  closing: string;
  body: string;
  subject: string;
  selected: boolean;
  hasContext: boolean;
}

export function BroadcastBuilder({ preset = [] }: { preset?: AudienceMember[] }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — the audience is built on the Search tab and arrives via `preset`
  // (?preset=<id>...). Here the user only confirms it: unselect people, sort.
  const [audience] = useState<AudienceMember[]>(preset);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(preset.filter((m) => m.primary_email).map((m) => m.id)),
  );
  const [sortBy, setSortBy] = useState<SortBy>("relevance");

  // Sorted view of the audience. "relevance" preserves search order; the
  // broadcast sorts order by last_broadcast_at, treating "never" as oldest.
  const sortedAudience = useMemo(() => {
    if (sortBy === "relevance") return audience;
    const ts = (m: AudienceMember) => (m.last_broadcast_at ? new Date(m.last_broadcast_at).getTime() : 0);
    const copy = [...audience];
    copy.sort((a, b) => (sortBy === "broadcast_newest" ? ts(b) - ts(a) : ts(a) - ts(b)));
    return copy;
  }, [audience, sortBy]);

  // Step 2
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [generating, setGenerating] = useState(false);

  // Step 3
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [sending, startSending] = useTransition();
  const [sendStatus, setSendStatus] = useState<string | null>(null);

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generatePersonalizations = async () => {
    if (!body.trim() || !subject.trim() || selected.size === 0) return;
    setGenerating(true);
    setSendStatus(null);
    const res = await fetch("/api/broadcast/personalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personIds: Array.from(selected), subject, body }),
    });
    const j = await res.json();
    setGenerating(false);
    if (!res.ok) {
      setSendStatus(`Error: ${j.error ?? "unknown"}`);
      return;
    }
    setDrafts(j.drafts.map((d: Omit<Draft, "selected">) => ({ ...d, selected: true })));
    setStep(3);
  };

  const send = async () => {
    const toSend = drafts.filter((d) => d.selected && d.to);
    if (toSend.length === 0) return;
    setSendStatus("Sending…");
    startSending(async () => {
      const res = await fetch("/api/broadcast/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: toSend.map((d) => ({
            personId: d.personId,
            to: d.to,
            subject: d.subject,
            intro: d.intro,
            body: d.body,
            closing: d.closing,
          })),
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setSendStatus(`Error: ${j.error ?? "send failed"}`);
        return;
      }
      setSendStatus(`Sent ${j.sent} of ${toSend.length}. ${j.failed ? `${j.failed} failed.` : ""}`);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <StepDot active={step === 1} done={step > 1} label="1. Confirm audience" />
        <StepDot active={step === 2} done={step > 2} label="2. Compose" />
        <StepDot active={step === 3} done={false} label="3. Review & send" />
      </div>

      {step === 1 ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Confirm audience</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {audience.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No audience yet. Go to <a href="/" className="underline">Search</a>, select the people you want,
                and click <strong>Add to broadcast audience</strong>.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-xs text-muted-foreground">
                    {selected.size} of {audience.length} selected · {audience.filter((a) => !a.primary_email).length} without email (excluded)
                  </div>
                  <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    Sort:
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortBy)}
                      className="h-7 rounded-md border bg-transparent px-2 text-xs"
                    >
                      <option value="relevance">Selection order</option>
                      <option value="broadcast_oldest">Last broadcast (oldest / never first)</option>
                      <option value="broadcast_newest">Last broadcast (most recent first)</option>
                    </select>
                  </label>
                </div>
                <div className="border rounded-md max-h-96 overflow-y-auto divide-y">
                  {sortedAudience.map((m) => (
                    <label key={m.id} className={`flex items-center gap-3 px-3 py-2 text-sm ${!m.primary_email ? "opacity-50" : ""}`}>
                      <input
                        type="checkbox"
                        checked={selected.has(m.id)}
                        onChange={() => toggle(m.id)}
                        disabled={!m.primary_email}
                      />
                      <span className="font-medium flex-1 truncate">{m.full_name}</span>
                      <span className="text-xs text-muted-foreground truncate">{m.primary_email ?? "(no email)"}</span>
                      <span className="text-xs text-muted-foreground shrink-0" title="Last broadcast">
                        {lastBroadcastLabel(m.last_broadcast_at)}
                      </span>
                      {!m.has_summary ? <Badge>no summary</Badge> : null}
                    </label>
                  ))}
                </div>
                <Button onClick={() => setStep(2)} disabled={selected.size === 0}>Continue to compose →</Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Canonical message</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <Label>Body</Label>
              <RichTextEditor value={body} onChange={setBody} />
              <p className="text-xs text-muted-foreground mt-1">Tip: don&apos;t include a greeting — we prepend &quot;Hey &lt;first name&gt;,&quot; automatically.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button onClick={generatePersonalizations} disabled={generating || !subject.trim() || !body.trim()}>
                {generating ? "Building…" : `Build ${selected.size} drafts`}
              </Button>
            </div>
            {sendStatus ? <p className="text-sm">{sendStatus}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Review</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Edit any draft. Uncheck to remove a recipient. Each goes out as an individual email.
            </p>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {drafts.map((d, i) => (
                <div key={d.personId} className="border rounded-md p-3 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={d.selected}
                      onChange={(e) => setDrafts((arr) => arr.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x))}
                    />
                    <span className="font-medium">{d.fullName}</span>
                    <span className="text-xs text-muted-foreground">{d.to}</span>
                  </div>
                  <Input
                    value={d.subject}
                    onChange={(e) => setDrafts((arr) => arr.map((x, j) => j === i ? { ...x, subject: e.target.value } : x))}
                  />
                  <Textarea
                    rows={2}
                    value={d.intro}
                    onChange={(e) => setDrafts((arr) => arr.map((x, j) => j === i ? { ...x, intro: e.target.value } : x))}
                  />
                  <div
                    className="text-xs text-muted-foreground border-l-2 border-muted pl-2 py-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-blue-600 [&_a]:underline [&_p]:my-1 [&_strong]:font-semibold"
                    dangerouslySetInnerHTML={{ __html: d.body }}
                  />
                  <Textarea
                    rows={2}
                    value={d.closing}
                    onChange={(e) => setDrafts((arr) => arr.map((x, j) => j === i ? { ...x, closing: e.target.value } : x))}
                    placeholder="(optional closing)"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>← Back to compose</Button>
              <Button onClick={send} disabled={sending || drafts.filter((d) => d.selected).length === 0}>
                {sending ? "Sending…" : `Send to ${drafts.filter((d) => d.selected).length}`}
              </Button>
            </div>
            {sendStatus ? <p className="text-sm">{sendStatus}</p> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs border ${active ? "bg-primary text-primary-foreground border-primary" : done ? "bg-muted" : ""}`}>
      {label}
    </span>
  );
}
