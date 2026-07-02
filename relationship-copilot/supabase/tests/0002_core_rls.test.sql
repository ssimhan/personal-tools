begin;

select plan(12);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'owner-a@example.test',
    'test-only',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'owner-b@example.test',
    'test-only',
    now(),
    now(),
    now()
  );

insert into public.people (id, owner_id, display_name)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'Owner A Person'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002',
    'Owner B Person'
  );

create function pg_temp.exec_row_count(statement text)
returns integer
language plpgsql
as $$
declare
  affected integer;
begin
  execute statement;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create function pg_temp.exec_sqlstate(statement text)
returns text
language plpgsql
as $$
begin
  execute statement;
  return null;
exception when others then
  return sqlstate;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

select is(
  (select count(*)::integer from public.people),
  1,
  'owner A sees only their own person'
);

select is(
  (select count(*)::integer from public.people where id = '10000000-0000-4000-8000-000000000002'),
  0,
  'owner A cannot select owner B person'
);

select is(
  pg_temp.exec_row_count($$update public.people set display_name = 'Changed' where id = '10000000-0000-4000-8000-000000000002'$$),
  0,
  'owner A cannot update owner B person'
);

select is(
  pg_temp.exec_row_count($$delete from public.people where id = '10000000-0000-4000-8000-000000000002'$$),
  0,
  'owner A cannot delete owner B person'
);

select is(
  pg_temp.exec_sqlstate($$insert into public.people (owner_id, display_name) values ('00000000-0000-4000-8000-000000000002', 'Cross owner')$$),
  '42501',
  'owner A cannot insert an owner B person'
);

select is(
  pg_temp.exec_sqlstate($$insert into public.person_channels (owner_id, person_id, type, value, normalized_value) values ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'email', 'b@example.test', 'b@example.test')$$),
  '23503',
  'owner A cannot attach a channel to owner B person'
);

select is(
  pg_temp.exec_sqlstate($$insert into public.interactions (owner_id, person_id, type, occurred_at, summary) values ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'meeting', now(), 'Cross-owner interaction')$$),
  '23503',
  'owner A cannot attach an interaction to owner B person'
);

select is(
  pg_temp.exec_sqlstate($$insert into public.person_channels (owner_id, person_id, type, value, normalized_value) values ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'email', 'a@example.test', 'a@example.test')$$),
  null,
  'owner A can attach their own channel'
);

select is(
  pg_temp.exec_sqlstate($$insert into public.interactions (owner_id, person_id, type, occurred_at, summary) values ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'meeting', now(), 'Owner A interaction')$$),
  null,
  'owner A can attach their own interaction'
);

select is(
  pg_temp.exec_sqlstate($$update public.people set owner_id = '00000000-0000-4000-8000-000000000002' where id = '10000000-0000-4000-8000-000000000001'$$),
  '42501',
  'owner A cannot transfer a person to owner B'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);

select is(
  (select count(*)::integer from public.people),
  1,
  'owner B sees only their own person'
);

reset role;
set local role anon;

select is(
  pg_temp.exec_sqlstate($$select * from public.people$$),
  '42501',
  'anonymous users have no people access'
);

select * from finish();
rollback;
