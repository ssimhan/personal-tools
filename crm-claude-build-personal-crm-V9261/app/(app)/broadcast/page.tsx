import { requireUser } from "@/lib/supabase/server";
import { BroadcastBuilder } from "./_builder";

export const dynamic = "force-dynamic";

interface SP { preset?: string | string[] }

export default async function BroadcastPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  // Preset audience: when arriving from the Search page with "Add to broadcast
  // audience" applied to selected contacts, hydrate those people now so the
  // builder lands directly on the audience-selection step with them ready.
  const presetIds = sp.preset ? (Array.isArray(sp.preset) ? sp.preset : [sp.preset]) : [];
  let preset: { id: string; full_name: string; primary_email: string | null; has_summary: boolean; last_broadcast_at: string | null }[] = [];
  if (presetIds.length) {
    const { data: people } = await supabase
      .from("people")
      .select("id, full_name, primary_email, relationship_summary, last_broadcast_at")
      .in("id", presetIds);
    preset = (people ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      primary_email: p.primary_email,
      has_summary: !!p.relationship_summary,
      last_broadcast_at: p.last_broadcast_at ?? null,
    }));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Broadcast</h1>
      <p className="text-sm text-muted-foreground">
        Build an audience, write the canonical message, AI personalizes only the intro and (optional) closing.
        Each recipient receives an individual email — not a group thread.
      </p>
      <BroadcastBuilder preset={preset} />
    </div>
  );
}
