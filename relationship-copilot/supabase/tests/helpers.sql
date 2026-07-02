begin;

select plan(1);

create or replace function public.test_uuid(value integer)
returns uuid
language sql
immutable
as $$
  select (
    '00000000-0000-4000-8000-' || lpad(value::text, 12, '0')
  )::uuid;
$$;

select pass('test helpers loaded');

select * from finish();
commit;
