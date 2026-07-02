"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquarePlus } from "lucide-react";

type Mode = "text" | "screenshot" | "email";

interface Candidate {
  id: string;
  full_name: string;
  primary_email: string | null;
}

export function QuickAdd() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("text");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [mismatchOverride, setMismatchOverride] = useState<{ forceCreate?: boolean }>({});
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const reset = () => {
    setContent("");
    setFile(null);
    setName("");
    setLinkedin("");
    setEmail("");
    setStatus(null);
    setWarning(null);
    setCandidates([]);
    setMode("text");
  };

  // override: 'force_person_id' (existing) | 'force_create' (skip resolution) | 'confirm_mismatch' (bypass guard)
  const submit = async (override?: { forcePersonId?: string; forceCreate?: boolean; confirmMismatch?: boolean }) => {
    setStatus(null);
    setWarning(null);

    const fd = new FormData();
    fd.set("mode", mode);
    if (name) fd.set("name", name);
    if (linkedin) fd.set("linkedin", linkedin);
    if (email) fd.set("email", email);
    if (override?.forcePersonId) fd.set("force_person_id", override.forcePersonId);
    if (override?.forceCreate) fd.set("force_create", "true");
    if (override?.confirmMismatch) fd.set("confirm_mismatch", "true");
    if (mode === "screenshot" && file) {
      fd.set("file", file);
    } else {
      fd.set("content", content);
    }

    setStatus("Processing…");
    const res = await fetch("/api/quick-add", { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) {
      if (json.warning === "email_name_mismatch") {
        // Remember whether we were on the create-new path so "Save anyway" resends with the same intent.
        setWarning(json.message ?? "Email and name don't match.");
        setStatus(null);
        if (override?.forceCreate) setMismatchOverride({ forceCreate: true });
        else setMismatchOverride({});
        return;
      }
      setStatus(json.error ?? "Failed");
      return;
    }
    if (json.needsIdentity) {
      setStatus("Couldn't identify the person — add a name + LinkedIn or email above.");
      return;
    }
    if (json.needsConfirmation) {
      setCandidates(json.candidates ?? []);
      setStatus(json.reason ?? "Found possible existing match — pick one or create new.");
      return;
    }
    if (json.lowExtraction) {
      setStatus(`Low OCR confidence (${Math.round((json.extractionConfidence ?? 0) * 100)}%). Review the extracted text:\n\n${json.extractedText}\n\nResubmit as text to save.`);
      setMode("text");
      setContent(json.extractedText ?? "");
      setFile(null);
      return;
    }
    setStatus("Logged.");
    startTransition(() => {
      router.refresh();
      setTimeout(() => {
        setOpen(false);
        reset();
      }, 300);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button><MessageSquarePlus className="h-4 w-4" />Add Interaction</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Log interaction</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 text-sm">
          {(["text", "email", "screenshot"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md border px-3 py-1 text-xs ${mode === m ? "bg-primary text-primary-foreground border-primary" : ""}`}
            >
              {m === "text" ? "Note" : m === "email" ? "Pasted email" : "Screenshot"}
            </button>
          ))}
        </div>

        {mode === "screenshot" ? (
          <div className="space-y-1">
            <Label>Screenshot</Label>
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              Image is OCR&apos;d to text at log time and discarded. The extracted text becomes the interaction.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <Label>Content</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={mode === "email" ? "Paste the full email here…" : "Notes from your conversation…"}
              rows={6}
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <Label>LinkedIn</Label>
            <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Identifiers are optional — we&apos;ll try to match from the content first. If no match, you&apos;ll be asked.
        </p>

        {status ? <pre className="text-xs whitespace-pre-wrap text-muted-foreground border rounded p-2">{status}</pre> : null}

        {warning ? (
          <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm space-y-2">
            <p>⚠ {warning}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => submit({ ...mismatchOverride, confirmMismatch: true })} disabled={pending}>
                Save anyway
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setWarning(null)}>Cancel</Button>
            </div>
          </div>
        ) : null}

        {candidates.length > 0 ? (
          <div className="space-y-2 border rounded-md p-2 bg-muted/30">
            <p className="text-xs font-medium">Existing matches — log this interaction to one of them?</p>
            {candidates.map((c) => (
              <button
                key={c.id}
                onClick={() => submit({ forcePersonId: c.id })}
                disabled={pending}
                className="w-full text-left rounded-md border bg-background hover:bg-accent px-3 py-2 text-sm"
              >
                <div className="font-medium">{c.full_name}</div>
                <div className="text-xs text-muted-foreground">{c.primary_email || "no email"}</div>
              </button>
            ))}
            <div className="flex justify-end pt-1">
              <Button size="sm" variant="outline" onClick={() => submit({ forceCreate: true })} disabled={pending}>
                Create new person instead
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
          <Button onClick={() => submit()} disabled={pending || (mode === "screenshot" ? !file : !content.trim())}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
