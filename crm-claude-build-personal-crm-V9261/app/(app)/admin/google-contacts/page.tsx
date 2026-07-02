import { requireUser } from "@/lib/supabase/server";
import { GoogleContactsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function GoogleContactsBackfillPage() {
  await requireUser();
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Google Contacts — phone backfill</h1>
      <p className="text-sm text-muted-foreground">
        One-shot tool: upload a Google Contacts CSV. For every row, we look for a CRM
        contact whose <strong>full name</strong> or <strong>email</strong> matches exactly
        (case-insensitive). If we find exactly one match AND that contact has no phone yet,
        we fill it from Google. Existing phones are never overwritten. Ambiguous matches
        (multiple contacts share the same name) are skipped.
      </p>
      <GoogleContactsClient />
    </div>
  );
}
