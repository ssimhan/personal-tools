-- Broadcast cadence: how many months should pass before the next outreach
-- "touch" for this contact. Used to sort/filter contacts when planning a
-- broadcast (it does NOT automatically send). Allowed values 2/4/6/8; NULL
-- means "None" (no cadence set).
alter table public.people
  add column if not exists broadcast_months smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'people_broadcast_months_check'
  ) then
    alter table public.people
      add constraint people_broadcast_months_check
      check (broadcast_months in (2, 4, 6, 8));
  end if;
end $$;

-- Speeds up the "sort by cadence" path in browse-mode search.
create index if not exists people_broadcast_months_idx
  on public.people (broadcast_months);
