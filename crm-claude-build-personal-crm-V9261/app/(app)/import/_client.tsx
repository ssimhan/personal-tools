"use client";

import { useState } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Row {
  full_name?: string;
  linkedin_url?: string;
  primary_email?: string;
  phone_number?: string;
  tags?: string;
  frequency?: string;
  [k: string]: string | undefined;
}

interface Tag { id: string; name: string }

export function ImportClient({ existingTags }: { existingTags: Tag[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [filename, setFilename] = useState<string>("");
  const [status, setStatus] = useState<string | null>(null);
  const [unknownTags, setUnknownTags] = useState<string[]>([]);
  const [pending, setPending] = useState(false);

  const onFile = (file: File) => {
    setFilename(file.name);
    setStatus(null);
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (res) => setRows(res.data.filter((r) => r.full_name && r.full_name.trim())),
    });
  };

  const submit = async () => {
    if (!rows.length) return;
    setPending(true);
    setStatus("Importing…");
    setUnknownTags([]);
    const res = await fetch("/api/people/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const json = await res.json();
    setPending(false);
    if (!res.ok) {
      setStatus(`Error: ${json.error ?? "unknown"}`);
      return;
    }
    setStatus(`Imported ${json.inserted} new, ${json.enriched ?? 0} updated (tags/missing info), ${json.skipped} skipped.`);
    setUnknownTags(json.unknownTags ?? []);
    setRows([]);
    setFilename("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upload CSV</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>CSV file</Label>
          <Input type="file" accept=".csv,text/csv" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }} />
          {filename ? <p className="text-xs text-muted-foreground mt-1">{filename} — {rows.length} rows parsed</p> : null}
        </div>

        {existingTags.length ? (
          <p className="text-xs text-muted-foreground">
            Tags in the <code>tags</code> column must match an existing tag — anything else is ignored, never created.
            Available: {existingTags.map((t) => t.name).join(", ")}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            No tags exist yet — create tags in Admin first; any <code>tags</code> values in the file are ignored.
          </p>
        )}

        {rows.length ? (
          <div className="border rounded-md text-xs">
            <div className="grid grid-cols-5 gap-2 p-2 bg-muted font-medium">
              <span>Name</span><span>Email</span><span>LinkedIn</span><span>Tags</span><span>Freq</span>
            </div>
            {rows.slice(0, 5).map((r, i) => (
              <div key={i} className="grid grid-cols-5 gap-2 p-2 border-t">
                <span className="truncate">{r.full_name}</span>
                <span className="truncate">{r.primary_email ?? r.email}</span>
                <span className="truncate">{r.linkedin_url}</span>
                <span className="truncate">{r.tags}</span>
                <span className="truncate">{r.frequency}</span>
              </div>
            ))}
            {rows.length > 5 ? <div className="p-2 text-muted-foreground border-t">…and {rows.length - 5} more</div> : null}
          </div>
        ) : null}

        <Button onClick={submit} disabled={!rows.length || pending}>
          {pending ? "Importing…" : `Import ${rows.length} ${rows.length === 1 ? "person" : "people"}`}
        </Button>
        {status ? <p className="text-sm">{status}</p> : null}
        {unknownTags.length ? (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Ignored {unknownTags.length} unknown {unknownTags.length === 1 ? "tag" : "tags"} (not in Admin):{" "}
            {unknownTags.join(", ")}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
