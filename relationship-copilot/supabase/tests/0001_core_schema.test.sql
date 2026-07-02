begin;

select plan(59);

select has_table('public', 'user_profiles', 'user_profiles exists');
select has_table('public', 'people', 'people exists');
select has_table('public', 'person_channels', 'person_channels exists');
select has_table('public', 'interactions', 'interactions exists');

select has_pk('public', 'user_profiles', 'user_profiles has a primary key');
select has_pk('public', 'people', 'people has a primary key');
select has_pk('public', 'person_channels', 'person_channels has a primary key');
select has_pk('public', 'interactions', 'interactions has a primary key');

select col_is_fk('public', 'user_profiles', 'id', 'profile id references auth.users');
select col_is_fk('public', 'people', 'owner_id', 'people owner references auth.users');
select col_is_fk('public', 'person_channels', 'owner_id', 'channel owner references auth.users');
select col_is_fk('public', 'person_channels', array['person_id', 'owner_id'], 'channel person and owner reference people');
select col_is_fk('public', 'interactions', 'owner_id', 'interaction owner references auth.users');
select col_is_fk('public', 'interactions', array['person_id', 'owner_id'], 'interaction person and owner reference people');

select has_column('public', 'people', 'display_name', 'people has display_name');
select has_column('public', 'people', 'company', 'people has company');
select has_column('public', 'people', 'relationship_summary', 'people has relationship_summary');
select has_column('public', 'people', 'notes', 'people has notes');
select has_column('public', 'people', 'created_at', 'people has created_at');
select has_column('public', 'people', 'updated_at', 'people has updated_at');

select has_column('public', 'user_profiles', 'created_at', 'profiles has created_at');
select has_column('public', 'user_profiles', 'updated_at', 'profiles has updated_at');

select has_column('public', 'person_channels', 'type', 'channels has type');
select has_column('public', 'person_channels', 'value', 'channels has value');
select has_column('public', 'person_channels', 'normalized_value', 'channels has normalized_value');
select has_column('public', 'person_channels', 'last_meaningful_at', 'channels has last_meaningful_at');

select has_column('public', 'interactions', 'type', 'interactions has type');
select has_column('public', 'interactions', 'occurred_at', 'interactions has occurred_at');
select has_column('public', 'interactions', 'summary', 'interactions has summary');
select has_column('public', 'interactions', 'source_record_id', 'interactions has source_record_id');
select has_column('public', 'interactions', 'created_at', 'interactions has created_at');
select has_column('public', 'interactions', 'updated_at', 'interactions has updated_at');

select col_not_null('public', 'people', 'owner_id', 'people owner is required');
select col_not_null('public', 'person_channels', 'owner_id', 'channel owner is required');
select col_not_null('public', 'interactions', 'owner_id', 'interaction owner is required');
select col_not_null('public', 'user_profiles', 'created_at', 'profile created_at is required');
select col_not_null('public', 'user_profiles', 'updated_at', 'profile updated_at is required');
select col_not_null('public', 'people', 'created_at', 'people created_at is required');
select col_not_null('public', 'people', 'updated_at', 'people updated_at is required');
select col_not_null('public', 'person_channels', 'created_at', 'channel created_at is required');
select col_not_null('public', 'person_channels', 'updated_at', 'channel updated_at is required');
select col_not_null('public', 'interactions', 'created_at', 'interaction created_at is required');
select col_not_null('public', 'interactions', 'updated_at', 'interaction updated_at is required');

select col_is_unique(
  'public',
  'person_channels',
  array['owner_id', 'type', 'normalized_value'],
  'channel identity is unique per owner'
);

select has_index(
  'public',
  'interactions',
  'interactions_owner_occurred_at_idx',
  'interactions have an owner-first timeline index'
);

select has_index(
  'public',
  'people',
  'people_owner_id_idx',
  'people have an owner-first index'
);

select has_index(
  'public',
  'person_channels',
  'person_channels_owner_person_idx',
  'channels have an owner-first person index'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_profiles'::regclass),
  'user_profiles has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.people'::regclass),
  'people has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.person_channels'::regclass),
  'person_channels has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.interactions'::regclass),
  'interactions has RLS enabled'
);

select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'user_profiles'),
  4,
  'user_profiles has owner CRUD policies'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'people'),
  4,
  'people has owner CRUD policies'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'person_channels'),
  4,
  'person_channels has owner CRUD policies'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'interactions'),
  4,
  'interactions has owner CRUD policies'
);

select is(
  (select count(*)::integer from information_schema.role_table_grants where table_schema = 'public' and table_name = 'user_profiles' and grantee = 'anon'),
  0,
  'anon has no user_profiles privileges'
);
select is(
  (select count(*)::integer from information_schema.role_table_grants where table_schema = 'public' and table_name = 'people' and grantee = 'anon'),
  0,
  'anon has no people privileges'
);
select is(
  (select count(*)::integer from information_schema.role_table_grants where table_schema = 'public' and table_name = 'person_channels' and grantee = 'anon'),
  0,
  'anon has no person_channels privileges'
);
select is(
  (select count(*)::integer from information_schema.role_table_grants where table_schema = 'public' and table_name = 'interactions' and grantee = 'anon'),
  0,
  'anon has no interactions privileges'
);

select * from finish();
rollback;
