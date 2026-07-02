-- Relationship Memory Layer — initial schema
-- Single-user product. RLS limits all rows to the owner.

create extension if not exists "pgcrypto";
create extension if not exists "vector";
create extension if not exists "pg_trgm";

-- ============================================================
-- people
-- ============================================================
create table public.people (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,

  -- identity
  full_name text not null,
  linkedin_url text,
  primary_email text,
  secondary_emails text[] not null default '{}',
  phone_number text,
  company text,

  -- communication
  preferred_channel text check (preferred_channel in ('email','linkedin','phone','slack','whatsapp')),
  slack_channel text,

  -- AI-owned
  relationship_summary text,
  relationship_summary_previous text,        -- single prior snapshot
  semantic_embedding vector(1536),           -- text-embedding-3-small dims

  -- human-owned
  permanent_notes text,

  -- metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_interaction_at timestamptz,
  interaction_count integer not null default 0,

  -- a minimum-viable person has a name AND (linkedin OR primary_email).
  -- Imports may still create records without either; we enforce the rule
  -- in application code (during Quick Add / manual create) rather than at
  -- the DB level, so bulk-imported attendee lists with only a name aren't
  -- rejected wholesale.
  constraint people_name_present check (length(trim(full_name)) > 0)
);

create index people_owner_idx on public.people(owner_id);
create index people_linkedin_idx on public.people(owner_id, linkedin_url) where linkedin_url is not null;
create index people_email_idx on public.people(owner_id, primary_email) where primary_email is not null;
create index people_last_interaction_idx on public.people(owner_id, last_interaction_at desc nulls last);
create index people_name_trgm_idx on public.people using gin (full_name gin_trgm_ops);
create index people_company_trgm_idx on public.people using gin (company gin_trgm_ops);

-- pgvector index for cosine similarity
create index people_embedding_idx on public.people
  using ivfflat (semantic_embedding vector_cosine_ops)
  with (lists = 100);

-- ============================================================
-- interactions (append-only)
-- ============================================================
create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,

  interaction_type text not null check (interaction_type in (
    'manual_note','pasted_email','screenshot','imported_contact','broadcast_sent'
  )),
  raw_content text not null,
  important_interaction boolean not null default false,

  -- optional metadata
  source text,
  matched_identity_confidence real,
  extraction_confidence real,                -- vision/OCR confidence for screenshots

  created_at timestamptz not null default now()
);

create index interactions_person_idx on public.interactions(person_id, created_at desc);
create index interactions_owner_idx on public.interactions(owner_id, created_at desc);

-- ============================================================
-- tags + junction
-- ============================================================
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.people_tags (
  person_id uuid not null references public.people(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (person_id, tag_id)
);

create index people_tags_tag_idx on public.people_tags(tag_id);

-- ============================================================
-- maintenance: keep updated_at fresh, keep counters fresh
-- ============================================================
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger people_updated_at
  before update on public.people
  for each row execute function public.touch_updated_at();

create or replace function public.bump_person_on_interaction() returns trigger as $$
begin
  update public.people
     set last_interaction_at = new.created_at,
         interaction_count = interaction_count + 1
   where id = new.person_id;
  return new;
end;
$$ language plpgsql;

create trigger interactions_bump_person
  after insert on public.interactions
  for each row execute function public.bump_person_on_interaction();

-- ============================================================
-- RLS — single-user product, but enforce per-owner anyway
-- ============================================================
alter table public.people enable row level security;
alter table public.interactions enable row level security;
alter table public.tags enable row level security;
alter table public.people_tags enable row level security;

create policy "owner reads people"   on public.people for select using (owner_id = auth.uid());
create policy "owner writes people"  on public.people for all    using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner reads ix"       on public.interactions for select using (owner_id = auth.uid());
create policy "owner writes ix"      on public.interactions for all    using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner reads tags"     on public.tags for select using (owner_id = auth.uid());
create policy "owner writes tags"    on public.tags for all    using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner reads pt"       on public.people_tags for select using (
  exists (select 1 from public.people p where p.id = people_tags.person_id and p.owner_id = auth.uid())
);
create policy "owner writes pt"      on public.people_tags for all using (
  exists (select 1 from public.people p where p.id = people_tags.person_id and p.owner_id = auth.uid())
) with check (
  exists (select 1 from public.people p where p.id = people_tags.person_id and p.owner_id = auth.uid())
);
