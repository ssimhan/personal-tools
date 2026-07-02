-- Feed tab data model: per-contact value tally (from 👍/👎 in the feed),
-- a snooze-until timestamp, and a 0–1 "notes priority" score the LLM writes
-- when the user saves permanent_notes.

alter table public.people
  add column if not exists value smallint not null default 0,
  add column if not exists snoozed_until timestamptz,
  add column if not exists notes_priority_score real;

-- Speeds up the Feed's "overdue contacts" filter as data grows.
create index if not exists people_feed_overdue_idx
  on public.people (owner_id, broadcast_months, last_interaction_at)
  where broadcast_months is not null;
