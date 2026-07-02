import { requireUser } from "@/lib/supabase/server";
import { search, parseSearchInput } from "@/lib/search";
import { config } from "@/lib/config";
import { SearchBar } from "./_components/search-bar";
import { Results } from "./_components/results";
import { QuickAdd } from "./_components/quick-add";
import { AddContact } from "./_components/add-contact";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { supabase } = await requireUser();

  // Build a URLSearchParams from the incoming params so filters/sort/paging are
  // parsed in exactly one place (shared with /api/search).
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) v.forEach((x) => params.append(k, x));
    else if (v != null) params.set(k, v);
  }
  const input = parseSearchInput(params);
  const tagIds = input.filters?.tagIds ?? [];

  const [{ data: tags }, { hits, hasMore }] = await Promise.all([
    supabase.from("tags").select("id, name").order("name"),
    search(supabase, input),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <div className="flex gap-2">
          <AddContact />
          <QuickAdd />
        </div>
      </div>

      <SearchBar
        defaultQuery={input.query}
        tags={tags ?? []}
        selectedTagIds={tagIds}
        acceptsAsksYes={!!input.filters?.acceptsAsksYes}
      />

      <Results hits={hits} hasMore={hasMore} query={input.query} allTags={tags ?? []} appBaseUrl={config.appBaseUrl} />
    </div>
  );
}
