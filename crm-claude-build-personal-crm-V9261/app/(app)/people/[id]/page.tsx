import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChannelDots } from "./_channels";
import { config } from "@/lib/config";
import { SummarySection } from "./_summary";
import { NotesSection } from "./_notes";
import { TagsSection } from "./_tags";
import { PersonActions } from "./_actions";
import { LogInteractionSection } from "./_log-interaction";

export const dynamic = "force-dynamic";

interface Interaction {
  id: string;
  interaction_type: string;
  raw_content: string;
  created_at: string;
}

// Whole-day diff between two ISO timestamps. Uses UTC date boundaries so
// "today" reads as 0 regardless of timezone weirdness around midnight.
function daysSince(iso: string): number {
  const then = new Date(iso);
  const now = new Date();
  const a = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const b = Date.UTC(then.getUTCFullYear(), then.getUTCMonth(), then.getUTCDate());
  return Math.max(0, Math.floor((a - b) / 86_400_000));
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n).trimEnd() + "…" : s;
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const [{ data: person }, { data: interactions }, { data: personTags }, { data: allTags }] = await Promise.all([
    supabase.from("people").select("*").eq("id", id).single(),
    supabase
      .from("interactions")
      .select("id, interaction_type, raw_content, created_at, extraction_confidence")
      .eq("person_id", id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("people_tags").select("tag_id, tags(id, name)").eq("person_id", id),
    supabase.from("tags").select("id, name").order("name"),
  ]);

  if (!person) notFound();

  const tagsOnPerson = (personTags ?? [])
    .flatMap((pt) => (Array.isArray(pt.tags) ? pt.tags : pt.tags ? [pt.tags] : []))
    .filter(Boolean) as unknown as { id: string; name: string }[];
  const ixs = (interactions ?? []) as Interaction[];

  // "Last interactions" card: three slots showing the most recent substantive
  // interactions (broadcast_sent / imported_contact are noise — skip them).
  // No AI calls; just raw days-ago counts + snippets.
  const lastThree = ixs
    .filter((i) => i.interaction_type !== "broadcast_sent" && i.interaction_type !== "imported_contact")
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">{person.full_name}</h1>
          </div>
          <PersonActions personId={person.id} personName={person.full_name} />
        </div>
        <ChannelDots person={person} appBaseUrl={config.appBaseUrl} />
        <TagsSection
          personId={person.id}
          allTags={allTags ?? []}
          personTags={tagsOnPerson}
        />
      </header>

      <NotesSection personId={person.id} notes={person.permanent_notes} />

      <LogInteractionSection personId={person.id} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Last interactions</CardTitle>
        </CardHeader>
        <CardContent>
          {lastThree.length === 0 ? (
            <p className="text-sm text-muted-foreground">No interactions yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((slot) => {
                const i = lastThree[slot];
                if (!i) {
                  return (
                    <div key={slot} className="border border-dashed rounded-md p-3 text-center text-muted-foreground/40">
                      <div className="text-3xl font-semibold leading-none">—</div>
                    </div>
                  );
                }
                const d = daysSince(i.created_at);
                return (
                  <div key={i.id} className="border rounded-md p-3">
                    <div className="text-3xl font-semibold leading-none">{d}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{d === 1 ? "day ago" : "days ago"}</div>
                    <p className="text-sm mt-2 line-clamp-3">{truncate(i.raw_content, 120)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <SummarySection
        personId={person.id}
        summary={person.relationship_summary}
        previousSummary={person.relationship_summary_previous}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent interactions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ixs.slice(0, 10).map((i) => (
            <div key={i.id} className="border rounded-md p-3 text-sm">
              <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                <Badge>{i.interaction_type.replace("_", " ")}</Badge>
                <span className="ml-auto">{new Date(i.created_at).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-wrap">{i.raw_content}</p>
            </div>
          ))}
          {ixs.length === 0 ? <p className="text-sm text-muted-foreground">No interactions yet.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
