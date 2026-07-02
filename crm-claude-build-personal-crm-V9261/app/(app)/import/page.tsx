import { requireUser } from "@/lib/supabase/server";
import { ImportClient } from "./_client";

const TEMPLATE_URL =
  "https://docs.google.com/spreadsheets/d/1h_UodaOMTIA1SyQPPj3vZimgCbhw-ycbPlra0mF8Jtw/edit?gid=1243942442#gid=1243942442";

export default async function ImportPage() {
  const { supabase } = await requireUser();
  const { data: tags } = await supabase.from("tags").select("id, name").order("name");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Import</h1>
      <p className="text-sm text-muted-foreground">
        Bulk-add people from CSV. No summaries or embeddings are generated — imported people are immediately
        searchable by tag and name, and live in the <em>No summary yet</em> filter until you log an
        interaction with them. Use the{" "}
        <a href={TEMPLATE_URL} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
          import template
        </a>{" "}
        for the expected columns.
      </p>
      <ImportClient existingTags={tags ?? []} />
    </div>
  );
}
