create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  company text,
  relationship_summary text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, owner_id)
);

create table public.person_channels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid not null,
  type text not null check (
    type in ('email', 'phone', 'text', 'whatsapp', 'slack', 'linkedin')
  ),
  value text not null check (length(trim(value)) > 0),
  normalized_value text not null check (length(trim(normalized_value)) > 0),
  last_meaningful_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint person_channels_person_owner_fk
    foreign key (person_id, owner_id)
    references public.people(id, owner_id)
    on delete cascade,
  unique (owner_id, type, normalized_value)
);

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid not null,
  type text not null check (length(trim(type)) > 0),
  occurred_at timestamptz not null,
  summary text not null check (length(trim(summary)) > 0),
  source_record_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint interactions_person_owner_fk
    foreign key (person_id, owner_id)
    references public.people(id, owner_id)
    on delete cascade
);

create index people_owner_id_idx
  on public.people(owner_id, updated_at desc);

create index person_channels_owner_person_idx
  on public.person_channels(owner_id, person_id);

create index interactions_owner_occurred_at_idx
  on public.interactions(owner_id, occurred_at desc);

create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create trigger people_set_updated_at
before update on public.people
for each row execute function public.set_updated_at();

create trigger person_channels_set_updated_at
before update on public.person_channels
for each row execute function public.set_updated_at();

create trigger interactions_set_updated_at
before update on public.interactions
for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
alter table public.people enable row level security;
alter table public.person_channels enable row level security;
alter table public.interactions enable row level security;

create policy user_profiles_select_own
on public.user_profiles for select
to authenticated
using (id = (select auth.uid()));

create policy user_profiles_insert_own
on public.user_profiles for insert
to authenticated
with check (id = (select auth.uid()));

create policy user_profiles_update_own
on public.user_profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy user_profiles_delete_own
on public.user_profiles for delete
to authenticated
using (id = (select auth.uid()));

create policy people_select_own
on public.people for select
to authenticated
using (owner_id = (select auth.uid()));

create policy people_insert_own
on public.people for insert
to authenticated
with check (owner_id = (select auth.uid()));

create policy people_update_own
on public.people for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy people_delete_own
on public.people for delete
to authenticated
using (owner_id = (select auth.uid()));

create policy person_channels_select_own
on public.person_channels for select
to authenticated
using (owner_id = (select auth.uid()));

create policy person_channels_insert_own
on public.person_channels for insert
to authenticated
with check (owner_id = (select auth.uid()));

create policy person_channels_update_own
on public.person_channels for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy person_channels_delete_own
on public.person_channels for delete
to authenticated
using (owner_id = (select auth.uid()));

create policy interactions_select_own
on public.interactions for select
to authenticated
using (owner_id = (select auth.uid()));

create policy interactions_insert_own
on public.interactions for insert
to authenticated
with check (owner_id = (select auth.uid()));

create policy interactions_update_own
on public.interactions for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy interactions_delete_own
on public.interactions for delete
to authenticated
using (owner_id = (select auth.uid()));

revoke all on public.user_profiles from anon;
revoke all on public.people from anon;
revoke all on public.person_channels from anon;
revoke all on public.interactions from anon;

grant select, insert, update, delete on public.user_profiles to authenticated;
grant select, insert, update, delete on public.people to authenticated;
grant select, insert, update, delete on public.person_channels to authenticated;
grant select, insert, update, delete on public.interactions to authenticated;
