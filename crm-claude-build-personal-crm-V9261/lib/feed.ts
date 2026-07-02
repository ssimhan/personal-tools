import type { SupabaseClient } from "@supabase/supabase-js";

// Feed = prioritized list of OVERDUE contacts. A contact is overdue when:
//   - broadcast_months is set (the user picked a cadence — 2/4/6/8), AND
//   - last_interaction_at is null OR last_interaction_at + N months <= now, AND
//   - they're not currently snoozed (snoozed_until is null or in the past).
//
// We fetch the candidate set in SQL, count tags + channels in app code, and
// rank with the priority() function below. Candidate set is small (hundreds
// max in practice), so no RPC is needed.

export const PRIORITY_WEIGHTS = {
  // Heavy signals — these drive most of the ordering.
  interactions: 3.0, // log2(1 + interaction_count) — engagement history
  value: 3.0,        // signed running tally from 👍/👎
  notes: 2.0,        // 0..1 LLM score on permanent_notes
  // Mild signals — break ties without dominating.
  channels: 0.5,
  tags: 0.5,
} as const;

export interface FeedRow {
  id: string;
  full_name: string;
  primary_email: string | null;
  secondary_emails: string[] | null;
  linkedin_url: string | null;
  phone_number: string | null;
  slack_channel: string | null;
  preferred_channel: string | null;
  text_method: string | null;
  contact_token: string | null;
  short_token: string | null;
  last_interaction_at: string | null;
  broadcast_months: number; // never null in the feed
  value: number;
  notes_priority_score: number | null;
  interaction_count: number;
  // Derived for ranking + display.
  channel_count: number;
  tag_count: number;
  priority_score: number;
  days_overdue: number; // 0 when "Never contacted" — sorted to top via priority
}

const PEOPLE_COLS =
  "id, full_name, primary_email, secondary_emails, linkedin_url, phone_number, slack_channel, preferred_channel, text_method, contact_token, short_token, last_interaction_at, broadcast_months, value, notes_priority_score, interaction_count";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function channelCount(p: any): number {
  let n = 0;
  if (p.primary_email) n++;
  if (p.linkedin_url) n++;
  if (p.phone_number) n++;
  if (p.slack_channel) n++;
  return n;
}

function daysOverdue(lastInteraction: string | null, months: number): number {
  if (!lastInteraction) return 0; // "Never" — handled separately by ranking
  const due = new Date(lastInteraction);
  due.setMonth(due.getMonth() + months);
  const diff = Math.floor((Date.now() - due.getTime()) / 86_400_000);
  return Math.max(0, diff);
}

// Pure priority score. Higher = more important to act on now.
export function priority(p: {
  interaction_count: number;
  value: number;
  notes_priority_score: number | null;
  channel_count: number;
  tag_count: number;
}): number {
  return (
    PRIORITY_WEIGHTS.interactions * Math.log2(1 + Math.max(0, p.interaction_count)) +
    PRIORITY_WEIGHTS.value * p.value +
    PRIORITY_WEIGHTS.notes * (p.notes_priority_score ?? 0) +
    PRIORITY_WEIGHTS.channels * p.channel_count +
    PRIORITY_WEIGHTS.tags * p.tag_count
  );
}

// Run the overdue filter in SQL, count tags via a single follow-up query, score
// in JS, sort descending. Returns rows ready for the Feed UI.
export async function feedCandidates(supabase: SupabaseClient): Promise<FeedRow[]> {
  const nowISO = new Date().toISOString();
  // PostgREST can't express "last_interaction_at + broadcast_months * interval"
  // directly, so pull every contact with a cadence + not-currently-snoozed, then
  // filter the overdue ones in JS. With a few thousand contacts this is fine;
  // move to an RPC if it ever bites.
  const { data, error } = await supabase
    .from("people")
    .select(PEOPLE_COLS)
    .not("broadcast_months", "is", null)
    .or(`snoozed_until.is.null,snoozed_until.lte.${nowISO}`);
  if (error) throw new Error(`feed query failed: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];

  // Filter to "overdue" using real calendar-month math.
  const now = Date.now();
  const overdue = rows.filter((p) => {
    if (!p.last_interaction_at) return true; // never contacted → always overdue
    const due = new Date(p.last_interaction_at);
    due.setMonth(due.getMonth() + (p.broadcast_months as number));
    return due.getTime() <= now;
  });
  if (overdue.length === 0) return [];

  // One follow-up query to count tags per candidate.
  const ids = overdue.map((p) => p.id as string);
  const { data: tagLinks } = await supabase
    .from("people_tags")
    .select("person_id")
    .in("person_id", ids);
  const tagCountById = new Map<string, number>();
  for (const r of tagLinks ?? []) {
    const k = (r as { person_id: string }).person_id;
    tagCountById.set(k, (tagCountById.get(k) ?? 0) + 1);
  }

  const enriched: FeedRow[] = overdue.map((p) => {
    const channel_count = channelCount(p);
    const tag_count = tagCountById.get(p.id as string) ?? 0;
    const interaction_count = (p.interaction_count as number) ?? 0;
    const value = (p.value as number) ?? 0;
    const notes_priority_score = (p.notes_priority_score as number | null) ?? null;
    const months = p.broadcast_months as number;
    return {
      id: p.id,
      full_name: p.full_name,
      primary_email: p.primary_email ?? null,
      secondary_emails: p.secondary_emails ?? null,
      linkedin_url: p.linkedin_url ?? null,
      phone_number: p.phone_number ?? null,
      slack_channel: p.slack_channel ?? null,
      preferred_channel: p.preferred_channel ?? null,
      text_method: p.text_method ?? null,
      contact_token: p.contact_token ?? null,
      short_token: p.short_token ?? null,
      last_interaction_at: p.last_interaction_at ?? null,
      broadcast_months: months,
      value,
      notes_priority_score,
      interaction_count,
      channel_count,
      tag_count,
      priority_score: priority({
        interaction_count,
        value,
        notes_priority_score,
        channel_count,
        tag_count,
      }),
      days_overdue: daysOverdue(p.last_interaction_at ?? null, months),
    };
  });

  enriched.sort((a, b) => b.priority_score - a.priority_score);
  return enriched;
}
