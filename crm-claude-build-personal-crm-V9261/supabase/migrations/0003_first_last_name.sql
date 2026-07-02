-- Split full_name into first_name + last_name for broadcast personalization.
-- full_name stays as the canonical display string (composed in app code on writes).
-- On existing rows we backfill by splitting on the first space.

alter table public.people
  add column first_name text,
  add column last_name text;

update public.people
   set first_name = split_part(full_name, ' ', 1),
       last_name = case
         when position(' ' in full_name) > 0
           then substring(full_name from position(' ' in full_name) + 1)
         else null
       end;
