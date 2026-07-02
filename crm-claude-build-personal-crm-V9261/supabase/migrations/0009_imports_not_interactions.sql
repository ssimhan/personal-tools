-- Imports are not real interactions. Stop the per-interaction trigger from
-- advancing last_interaction_at (and the interaction count) for imported_contact
-- rows, and recompute the column for existing contacts so historical imports no
-- longer masquerade as the most recent interaction.

create or replace function public.bump_person_on_interaction() returns trigger as $$
begin
  -- A CSV import isn't a real touchpoint — don't advance last_interaction_at.
  if new.interaction_type = 'imported_contact' then
    return new;
  end if;
  update public.people
     set last_interaction_at = new.created_at,
         interaction_count = interaction_count + 1
   where id = new.person_id;
  return new;
end;
$$ language plpgsql;

-- Backfill: recompute last_interaction_at from non-import interactions.
update public.people p
   set last_interaction_at = sub.max_created
  from (
    select person_id, max(created_at) as max_created
      from public.interactions
     where interaction_type <> 'imported_contact'
     group by person_id
  ) sub
 where sub.person_id = p.id;

-- Contacts whose only interactions were imports → clear the stale timestamp.
update public.people p
   set last_interaction_at = null
 where not exists (
   select 1 from public.interactions i
    where i.person_id = p.id
      and i.interaction_type <> 'imported_contact'
 );
