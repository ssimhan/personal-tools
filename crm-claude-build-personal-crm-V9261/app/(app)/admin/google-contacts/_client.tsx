"use client";

import { useState } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Google Contacts CSV exports vary slightly between "Google CSV" and "Outlook
// CSV" formats. Column names land as "First Name", "Last Name",
// "E-mail 1 - Value" / "Email 1 - Value", "Phone 1 - Value" etc.
// We loosely match any column whose name contains "phone" + " - Value" as a
// phone candidate, and any column containing "mail" + " - Value" as an email
// candidate, taking the first non-empty one.
type RawRow = Record<string, string | undefined>;
interface NormRow { fullName: string; email: string; phone: string }

function normalize(row: RawRow): NormRow {
  const first = (row["First Name"] ?? "").trim();
  const last = (row["Last Name"] ?? "").trim();
  const fullName = [first, last].filter(Boolean).join(" ").trim();

  let email = "";
  let phone = "";
  for (const [k, v] of Object.entries(row)) {
    if (!v) continue;
    const key = k.toLowerCase();
    if (!email && key.endsWith("- value") && (key.includes("mail") || key.includes("email"))) {
      email = String(v).trim().toLowerCase();
    }
    if (!phone && key.endsWith("- value") && key.includes("phone")) {
      // Google sometimes joins multiple phones with " ::: " — take the first.
      phone = String(v).split(":::")[0].trim();
    }
  }
  return { fullName, email, phone };
}

interface Result {
  inputRows: number;
  updated: number;
  alreadyHadPhone: number;
  noMatch: number;
  ambiguous: number;
  noPhoneInRow: number;
  examples: { name: string; phone: string }[];
}

export function GoogleContactsClient() {
  const [rows, setRows] = useState<NormRow[]>([]);
  const [filename, setFilename] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = (file: File) => {
    setFilename(file.name);
    setError(null);
    setResult(null);
    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const normed = res.data.map(normalize).filter((r) => r.phone);
        setRows(normed);
      },
    });
  };

  const submit = async () => {
    if (!rows.length) return;
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/google-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "failed");
        return;
      }
      setResult(j);
      setRows([]);
      setFilename("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upload Google Contacts CSV</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>CSV file</Label>
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          {filename ? (
            <p className="text-xs text-muted-foreground mt-1">
              {filename} — {rows.length} rows with a phone number
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground mt-1">
            In Google Contacts → Export → choose <em>Google CSV</em>. Rows without a phone
            are dropped on the client; nothing leaves your browser until you click the button.
          </p>
        </div>

        <Button onClick={submit} disabled={!rows.length || pending}>
          {pending ? "Backfilling…" : `Run backfill on ${rows.length} rows`}
        </Button>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {result ? (
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div className="text-muted-foreground">Rows processed</div>
              <div className="font-medium">{result.inputRows}</div>
              <div className="text-muted-foreground">Phones added</div>
              <div className="font-medium text-green-600 dark:text-green-400">{result.updated}</div>
              <div className="text-muted-foreground">Already had a phone</div>
              <div>{result.alreadyHadPhone}</div>
              <div className="text-muted-foreground">No CRM match</div>
              <div>{result.noMatch}</div>
              <div className="text-muted-foreground">Ambiguous name match (skipped)</div>
              <div>{result.ambiguous}</div>
              <div className="text-muted-foreground">Row had no phone</div>
              <div>{result.noPhoneInRow}</div>
            </div>
            {result.examples.length > 0 ? (
              <div>
                <p className="text-xs text-muted-foreground mt-2">First few updates:</p>
                <ul className="list-disc pl-5 text-xs">
                  {result.examples.map((e, i) => (
                    <li key={i}>{e.name} → {e.phone}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
