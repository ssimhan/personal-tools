-- Cache of AI-generated per-month timeline summaries.
-- Shape: { "YYYY-MM": { summary: "...", lastInteractionAt: "ISO-8601" } }
-- The lastInteractionAt is the most recent interaction included in the summary,
-- used as a cache key — if a newer interaction shows up in that month, the
-- cached summary is regenerated.

alter table public.people
  add column month_summaries jsonb not null default '{}';
