import { requireUser } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteTagButton } from "./_delete-tag";
import { AddTagButton } from "./_add-tag";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { supabase } = await requireUser();

  // Fetch tags + counts in one round trip. Supabase doesn't return COUNT
  // directly with the relational select, so we use the two queries pattern.
  const [{ data: tags }, { data: links }, { data: peopleRows }] = await Promise.all([
    supabase.from("tags").select("id, name, created_at").order("name"),
    supabase.from("people_tags").select("tag_id, person_id"),
    supabase.from("people").select("id"),
  ]);

  const counts = new Map<string, number>();
  for (const l of links ?? []) counts.set(l.tag_id, (counts.get(l.tag_id) ?? 0) + 1);

  const totalPeople = peopleRows?.length ?? 0;
  const totalTags = tags?.length ?? 0;
  const untaggedCount = (() => {
    const tagged = new Set((links ?? []).map((l) => l.person_id));
    return (peopleRows ?? []).filter((p) => !tagged.has(p.id)).length;
  })();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <a href="/admin/google-contacts" className="text-sm text-blue-600 hover:underline">
            Google Contacts → phone backfill
          </a>
          <p className="text-xs text-muted-foreground mt-1">
            One-shot: upload a Google Contacts CSV and we&apos;ll fill in missing phones on any
            CRM contact whose name or email matches exactly.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">At a glance</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-2xl font-semibold">{totalPeople}</div>
            <div className="text-muted-foreground">people</div>
          </div>
          <div>
            <div className="text-2xl font-semibold">{totalTags}</div>
            <div className="text-muted-foreground">tags</div>
          </div>
          <div>
            <div className="text-2xl font-semibold">{untaggedCount}</div>
            <div className="text-muted-foreground">untagged</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">Tags</CardTitle>
          <AddTagButton />
        </CardHeader>
        <CardContent>
          {(tags ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No tags yet.</p>
          ) : (
            <div className="divide-y">
              {(tags ?? []).map((t) => {
                const n = counts.get(t.id) ?? 0;
                return (
                  <div key={t.id} className="flex items-center justify-between py-2 text-sm">
                    <a
                      href={`/?tag=${t.id}`}
                      className="font-medium hover:underline"
                      title="Filter search by this tag"
                    >
                      {t.name}
                    </a>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {n} {n === 1 ? "contact" : "contacts"}
                      </span>
                      <DeleteTagButton tagId={t.id} tagName={t.name} count={n} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
