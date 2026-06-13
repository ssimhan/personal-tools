-- find_people_by_emails: given an owner and a set of addresses (the To field of
-- an inbound BCC'd email), return that owner's contacts whose PRIMARY or ANY
-- SECONDARY email matches. Matching is case- and whitespace-insensitive on both
-- sides, so a hit works regardless of how the address was typed/stored.
--
-- Replaces the previous two-query approach in the inbound route (an `.in()` on
-- primary_email plus an array `.overlaps()` on secondary_emails), which was
-- case-sensitive and whose errors were silently ignored.
create or replace function public.find_people_by_emails(
  owner uuid,
  emails text[]
)
returns table (id uuid)
language sql
stable
as $$
  with norm as (
    select array_agg(distinct lower(trim(e))) as arr
      from unnest(emails) e
     where coalesce(trim(e), '') <> ''
  )
  select p.id
    from public.people p, norm
   where p.owner_id = owner
     and norm.arr is not null
     and (
       lower(trim(p.primary_email)) = any(norm.arr)
       or exists (
         select 1
           from unnest(p.secondary_emails) se
          where lower(trim(se)) = any(norm.arr)
       )
     );
$$;
