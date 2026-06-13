"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserPlus } from "lucide-react";

export function AddContact() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [permanentNotes, setPermanentNotes] = useState("");
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setFirstName(""); setLastName(""); setEmail(""); setLinkedin("");
    setPermanentNotes(""); setSummary(""); setStatus(null); setWarning(null);
  };

  const submit = async (confirmMismatch = false) => {
    setStatus("Saving…");
    setWarning(null);
    const res = await fetch("/api/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, email, linkedin, permanentNotes, summary, confirmMismatch }),
    });
    const json = await res.json();
    if (!res.ok) {
      if (json.warning === "email_name_mismatch") {
        setWarning(json.message ?? "Email and name don't match.");
        setStatus(null);
        return;
      }
      setStatus(json.error ?? "Failed");
      return;
    }
    setStatus("Saved.");
    startTransition(() => {
      router.refresh();
      setTimeout(() => {
        setOpen(false);
        reset();
        router.push(`/people/${json.personId}`);
      }, 300);
    });
  };

  const canSubmit = firstName.trim() && (email.trim() || linkedin.trim()) && !pending;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><UserPlus className="h-4 w-4" />Add Contact</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add contact</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>First name <span className="text-destructive">*</span></Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>Last name</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
          </div>
          <div>
            <Label>LinkedIn</Label>
            <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/…" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">Provide at least one of email or LinkedIn.</p>

        <div>
          <Label>Permanent notes</Label>
          <Textarea
            rows={2}
            value={permanentNotes}
            onChange={(e) => setPermanentNotes(e.target.value)}
            placeholder="Authoritative facts the AI must respect. e.g. 'Loves blunt feedback. Mention daughter Mia.'"
          />
        </div>

        <div>
          <Label>Relationship summary (optional)</Label>
          <Textarea
            rows={3}
            value={summary}
            onChange={(e) => setSummary(e.target.value.slice(0, 1000))}
            placeholder="Leave blank — the AI will generate this from your first interaction."
          />
          <p className="text-xs text-muted-foreground mt-1">{summary.length} / 1000</p>
        </div>

        {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
        {warning ? (
          <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm space-y-2">
            <p>⚠ {warning}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => submit(true)} disabled={pending}>Save anyway</Button>
              <Button size="sm" variant="ghost" onClick={() => setWarning(null)}>Cancel</Button>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
          <Button onClick={() => submit(false)} disabled={!canSubmit}>{pending ? "Saving…" : "Save contact"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
