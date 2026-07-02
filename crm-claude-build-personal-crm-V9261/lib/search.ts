import type { SupabaseClient } from "@supabase/supabase-js";
import { embed } from "@/lib/ai/openai";
import { config } from "@/lib/config";

// Two retrieval modes:
//   - Ranked (semantic): a text query, no date sort. Cosine ranking over people
//     with embeddings, subject to the hard floor; structured + date filters
//     narrow the candidate set first (filter-then-rank).
//   - Browse: no text query, OR a date sort is chosen. A pure SQL query over
//     people with structured + date filters, ordered by a date column, with
//     offset pagination. Fully server-side and indexed → scales to many rows.

export type DateBucket = "any" | "7" | "30" | "older" | "never";

export interface SearchSort {
  key: "interaction" | "broadcast" | "broadcast_months";
  dir: "asc" | "desc";
}

export type BroadcastFilter = "2" | "4" | "6" | "8" | "none";

export interface SearchFilters {
  tagIds?: string[];
  channel?: "email" | "linkedin" | "phone" | "slack" | "whatsapp" | "text" | null;
  noSummaryYet?: boolean;
  lastInteraction?: DateBucket;
  lastBroadcast?: DateBucket;
  broadcastMonths?: BroadcastFilter;
  acceptsAsksYes?: boolean; // when true → only contacts who said yes to small asks
}

export interface SearchInput {
  query: string;
  filters?: SearchFilters;
  sort?: SearchSort | null;
  limit?: number;
  offset?: number;
}

export interface SearchHit {
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
  relationship_summary: string | null;
  last_interaction_at: string | null;
  last_broadcast_at: string | null;
  broadcast_months: number | null;
  has_summary: boolean;
  similarity: number | null;
  matched_via: "semantic" | "structured" | "no_summary_filter";
}

export interface SearchResult {
  hits: SearchHit[];
  hasMore: boolean;
}

// Parse a URLSearchParams into a SearchInput. Shared by the dashboard page (SSR
// first page) and the /api/search route (Load-More + extension/broadcast), so
// the URL is the single source of truth for query, filters, sort, and paging.
export function parseSearchInput(params: URLSearchParams): SearchInput {
  const tagIds = params.getAll("tag");
  const channel = params.get("channel") as SearchFilters["channel"];
  const li = params.get("li") as DateBucket | null;
  const lb = params.get("lb") as DateBucket | null;
  const sortKey = params.get("sort");
  const sort: SearchSort | null =
    sortKey === "interaction" || sortKey === "broadcast" || sortKey === "broadcast_months"
      ? { key: sortKey, dir: params.get("dir") === "asc" ? "asc" : "desc" }
      : null;
  const bm = params.get("bm") as BroadcastFilter | null;
  const limit = Number(params.get("limit")) || 50;
  const offset = Number(params.get("offset")) || 0;
  return {
    query: params.get("q") ?? "",
    filters: {
      tagIds: tagIds.length ? tagIds : undefined,
      channel: channel ?? undefined,
      noSummaryYet: params.get("no_summary") === "1" || undefined,
      lastInteraction: li ?? undefined,
      lastBroadcast: lb ?? undefined,
      broadcastMonths: bm ?? undefined,
      acceptsAsksYes: params.get("aa") === "1" || undefined,
    },
    sort,
    limit,
    offset,
  };
}

const PEOPLE_COLS =
  "id, full_name, primary_email, secondary_emails, linkedin_url, phone_number, slack_channel, preferred_channel, text_method, contact_token, short_token, relationship_summary, last_interaction_at, last_broadcast_at, broadcast_months";

type PersonRow = Record<string, unknown>;

function toHit(p: PersonRow, matched_via: SearchHit["matched_via"], similarity: number | null): SearchHit {
  return {
    id: p.id as string,
    full_name: p.full_name as string,
    primary_email: (p.primary_email as string) ?? null,
    secondary_emails: (p.secondary_emails as string[]) ?? null,
    linkedin_url: (p.linkedin_url as string) ?? null,
    phone_number: (p.phone_number as string) ?? null,
    slack_channel: (p.slack_channel as string) ?? null,
    preferred_channel: (p.preferred_channel as string) ?? null,
    text_method: (p.text_method as string) ?? null,
    contact_token: (p.contact_token as string) ?? null,
    short_token: (p.short_token as string) ?? null,
    relationship_summary: (p.relationship_summary as string) ?? null,
    last_interaction_at: (p.last_interaction_at as string) ?? null,
    last_broadcast_at: (p.last_broadcast_at as string) ?? null,
    broadcast_months: (p.broadcast_months as number) ?? null,
    has_summary: !!p.relationship_summary,
    similarity,
    matched_via,
  };
}

function cutoffISO(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

// Apply a recency bucket to a Supabase query builder for a given date column.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyBucket(qb: any, col: string, bucket: DateBucket | undefined): any {
  if (!bucket || bucket === "any") return qb;
  if (bucket === "never") return qb.is(col, null);
  if (bucket === "7") return qb.gte(col, cutoffISO(7));
  if (bucket === "30") return qb.gte(col, cutoffISO(30));
  return qb.lt(col, cutoffISO(30)); // "older" — note: .lt excludes NULLs
}

// Apply the broadcast-cadence filter: "none" → cadence unset (NULL); a number →
// exact match. Undefined leaves the query untouched.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyBroadcastFilter(qb: any, bm: BroadcastFilter | undefined): any {
  if (!bm) return qb;
  if (bm === "none") return qb.is("broadcast_months", null);
  return qb.eq("broadcast_months", Number(bm));
}

export async function search(supabase: SupabaseClient, input: SearchInput): Promise<SearchResult> {
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;
  const q = input.query.trim();
  const f = input.filters ?? {};

  // A date sort forces browse mode (can't order by similarity AND date).
  const browseMode = !q || !!input.sort;

  if (browseMode) {
    return browseQuery(supabase, q, f, input.sort ?? null, limit, offset);
  }
  return rankedQuery(supabase, q, f, limit, offset);
}

// ---------------------------------------------------------------------------
// Browse mode — server-side filter + sort + pagination (scales).
// ---------------------------------------------------------------------------
async function browseQuery(
  supabase: SupabaseClient,
  q: string,
  f: SearchFilters,
  sort: SearchSort | null,
  limit: number,
  offset: number,
): Promise<SearchResult> {
  const useTagJoin = !!(f.tagIds && f.tagIds.length);
  const select = useTagJoin ? `${PEOPLE_COLS}, people_tags!inner(tag_id)` : PEOPLE_COLS;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let qb: any = supabase.from("people").select(select);
  if (useTagJoin) qb = qb.in("people_tags.tag_id", f.tagIds as string[]);
  if (f.channel) qb = qb.eq("preferred_channel", f.channel);
  if (f.noSummaryYet) qb = qb.is("relationship_summary", null);
  if (f.acceptsAsksYes) qb = qb.eq("accepts_asks", true);
  if (q) qb = qb.ilike("full_name", `%${q}%`);
  qb = applyBucket(qb, "last_interaction_at", f.lastInteraction);
  qb = applyBucket(qb, "last_broadcast_at", f.lastBroadcast);
  qb = applyBroadcastFilter(qb, f.broadcastMonths);

  const sortCol =
    sort?.key === "broadcast"
      ? "last_broadcast_at"
      : sort?.key === "broadcast_months"
        ? "broadcast_months"
        : "last_interaction_at";
  const asc = sort?.dir === "asc";
  // Dates: asc → "never" (NULL) first (oldest); desc → most-recent first, NULLs
  // last. Cadence: None (NULL) always sorts last — it means "no cadence set".
  const nullsFirst = sort?.key === "broadcast_months" ? false : asc;
  qb = qb.order(sortCol, { ascending: asc, nullsFirst });

  // Fetch one extra row to detect hasMore.
  qb = qb.range(offset, offset + limit);

  const { data, error } = await qb;
  if (error) throw new Error(`browse query failed: ${error.message}`);
  const rows = (data ?? []) as PersonRow[];
  const hasMore = rows.length > limit;
  const matched_via: SearchHit["matched_via"] = f.noSummaryYet ? "no_summary_filter" : "structured";
  const hits = rows.slice(0, limit).map((p) => toHit(p, matched_via, null));
  return { hits, hasMore };
}

// ---------------------------------------------------------------------------
// Ranked mode — semantic filter-then-rank with offset pagination.
// ---------------------------------------------------------------------------
async function rankedQuery(
  supabase: SupabaseClient,
  q: string,
  f: SearchFilters,
  limit: number,
  offset: number,
): Promise<SearchResult> {
  // Candidate set from structured + date filters (null = search everyone).
  const candidateIds = await candidateIdsFor(supabase, f);

  const queryEmbedding = await embed(q);
  // Pull enough to cover the requested page (+1 to detect hasMore).
  const matchLimit = offset + limit + 1;
  const { data: matches, error } = await supabase.rpc("match_people", {
    query_embedding: queryEmbedding,
    similarity_floor: config.semanticSimilarityFloor,
    match_limit: matchLimit,
    candidate_ids: candidateIds,
  });
  if (error) throw new Error(`semantic search failed: ${error.message}`);

  const semanticIds = (matches ?? []).map((m: { id: string }) => m.id);
  const simById = new Map((matches ?? []).map((m: { id: string; similarity: number }) => [m.id, m.similarity]));

  // Also fold in structured name/tag matches for the query, intersected with
  // the candidate set when a structured filter is active.
  let structuredIds = await structuredQueryMatch(supabase, q, matchLimit);
  if (candidateIds !== null) {
    const candidateSet = new Set(candidateIds);
    structuredIds = structuredIds.filter((id) => candidateSet.has(id));
  }
  const semanticSet = new Set(semanticIds);
  const mergedIds = [...semanticIds, ...structuredIds.filter((id) => !semanticSet.has(id))];

  const pageIds = mergedIds.slice(offset, offset + limit);
  const hasMore = mergedIds.length > offset + limit;
  if (pageIds.length === 0) return { hits: [], hasMore: false };

  const { data: people } = await supabase.from("people").select(PEOPLE_COLS).in("id", pageIds);
  const byId = new Map((people ?? []).map((p) => [(p as PersonRow).id as string, p as PersonRow]));
  const hits = pageIds.flatMap((id): SearchHit[] => {
    const p = byId.get(id);
    if (!p) return [];
    const sim = simById.get(id) ?? null;
    return [toHit(p, sim != null ? "semantic" : "structured", typeof sim === "number" ? sim : null)];
  });
  return { hits, hasMore };
}

// Candidate person ids matching structured + date filters. Returns null when no
// such filter is active (meaning "all people are candidates").
async function candidateIdsFor(supabase: SupabaseClient, f: SearchFilters): Promise<string[] | null> {
  const hasStructured = (f.tagIds && f.tagIds.length) || f.channel || f.noSummaryYet || !!f.broadcastMonths || !!f.acceptsAsksYes;
  const hasDate =
    (f.lastInteraction && f.lastInteraction !== "any") || (f.lastBroadcast && f.lastBroadcast !== "any");
  if (!hasStructured && !hasDate) return null;

  const useTagJoin = !!(f.tagIds && f.tagIds.length);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let qb: any = supabase.from("people").select(useTagJoin ? "id, people_tags!inner(tag_id)" : "id");
  if (useTagJoin) qb = qb.in("people_tags.tag_id", f.tagIds as string[]);
  if (f.channel) qb = qb.eq("preferred_channel", f.channel);
  if (f.noSummaryYet) qb = qb.is("relationship_summary", null);
  if (f.acceptsAsksYes) qb = qb.eq("accepts_asks", true);
  qb = applyBucket(qb, "last_interaction_at", f.lastInteraction);
  qb = applyBucket(qb, "last_broadcast_at", f.lastBroadcast);
  qb = applyBroadcastFilter(qb, f.broadcastMonths);

  const { data } = await qb;
  return (data ?? []).map((r: { id: string }) => r.id);
}

async function structuredQueryMatch(supabase: SupabaseClient, q: string, limit: number): Promise<string[]> {
  const pattern = `%${q}%`;
  const { data: nameMatches } = await supabase
    .from("people")
    .select("id")
    .ilike("full_name", pattern)
    .limit(limit);

  const { data: tagMatches } = await supabase.from("tags").select("id").ilike("name", pattern);
  const tagIds = (tagMatches ?? []).map((t) => t.id);
  let viaTagIds: string[] = [];
  if (tagIds.length) {
    const { data: pt } = await supabase.from("people_tags").select("person_id").in("tag_id", tagIds);
    viaTagIds = (pt ?? []).map((r) => r.person_id);
  }

  const merged = new Set<string>();
  (nameMatches ?? []).forEach((r) => merged.add(r.id));
  viaTagIds.forEach((id) => merged.add(id));
  return Array.from(merged).slice(0, limit);
}
