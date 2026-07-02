-- One-time backfill: anybody currently tagged "B-Ask" (case-insensitive) is
-- treated as already having opted in to small asks. Sets accepts_asks = true
-- for those people. Existing values are overwritten — if someone said No
-- through the public form but also has the legacy tag, the tag wins here.
update public.people p
   set accepts_asks = true
  from public.people_tags pt
  join public.tags t on t.id = pt.tag_id
 where pt.person_id = p.id
   and lower(t.name) = 'b-ask';
