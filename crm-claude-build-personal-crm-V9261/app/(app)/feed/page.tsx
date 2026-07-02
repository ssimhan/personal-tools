import { requireUser } from "@/lib/supabase/server";
import { feedCandidates } from "@/lib/feed";
import { config } from "@/lib/config";
import { FeedList } from "../_components/feed-list";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const { supabase } = await requireUser();
  const [items, { data: tags }] = await Promise.all([
    feedCandidates(supabase),
    supabase.from("tags").select("id, name").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Feed</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Contacts who are overdue for a touch, ranked by priority. Use 👍/👎 to teach the
          ranking, ▶️ to snooze for 30 days, and ✅ to log what you did (which clears them).
        </p>
      </div>
      <FeedList initialItems={items} allTags={tags ?? []} appBaseUrl={config.appBaseUrl} />
    </div>
  );
}
