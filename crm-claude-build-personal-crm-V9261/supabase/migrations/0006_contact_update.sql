-- Contact-update self-service: per-person token, text method, channel rename.

-- Capability token for the public contact-update screen (/c/<token>).
-- Add NULLABLE first (metadata-only), backfill, then set default + not null.
-- Adding a NOT NULL column with a volatile default would rewrite the whole
-- table — which rebuilds the pgvector ivfflat index and blows past the free
-- tier's maintenance_work_mem. Splitting it avoids any table rewrite.
alter table public.people add column if not exists contact_token uuid;
update public.people set contact_token = gen_random_uuid() where contact_token is null;
alter table public.people alter column contact_token set default gen_random_uuid();
alter table public.people alter column contact_token set not null;
create unique index if not exists people_contact_token_idx on public.people(contact_token);

-- Text channel reuses the phone number; method picks SMS vs WhatsApp.
-- Nullable, no default → metadata-only, no rewrite.
alter table public.people add column if not exists text_method text;
do $$ begin
  alter table public.people add constraint people_text_method_chk check (text_method in ('sms','whatsapp'));
exception when duplicate_object then null; end $$;

-- Rename the WhatsApp channel to Text in preferred_channel.
update public.people set preferred_channel = 'text' where preferred_channel = 'whatsapp';
alter table public.people drop constraint people_preferred_channel_check;
alter table public.people
  add constraint people_preferred_channel_check
  check (preferred_channel in ('email','linkedin','phone','slack','text'));

-- New interaction type for contact self-updates (logged with an old→new diff).
alter table public.interactions drop constraint interactions_interaction_type_check;
alter table public.interactions
  add constraint interactions_interaction_type_check
  check (interaction_type in (
    'manual_note','pasted_email','screenshot','imported_contact','broadcast_sent','contact_update'
  ));
