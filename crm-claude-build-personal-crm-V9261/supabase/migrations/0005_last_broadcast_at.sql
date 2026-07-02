-- Track the last time a broadcast was sent to each person, surfaced on the
-- broadcast audience builder and sortable there (e.g. "who haven't I emailed
-- in a while?"). Set whenever a broadcast_sent interaction is logged.

alter table public.people
  add column last_broadcast_at timestamptz;

create index people_last_broadcast_idx
  on public.people(owner_id, last_broadcast_at desc nulls last);
