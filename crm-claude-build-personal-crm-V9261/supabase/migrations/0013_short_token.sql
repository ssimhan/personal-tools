-- Shorter, friendlier contact-update URL token. 10 lowercase alphanumeric chars
-- (36^10 ≈ 3.7e15 combos) — not cryptographically strong, but the link is a
-- capability for a single-user, low-stakes form. The unique index catches the
-- vanishingly rare collision.
--
-- The legacy contact_token (UUID) column is kept around so URLs already sent in
-- old broadcast emails keep working — lookup routes accept either.

create or replace function public.gen_short_token() returns text
  language sql volatile as $$
  select string_agg(
           substr('abcdefghijklmnopqrstuvwxyz0123456789', (floor(random() * 36) + 1)::int, 1),
           ''
         )
  from generate_series(1, 10);
$$;

alter table public.people
  add column if not exists short_token text;

-- Backfill every existing row (fresh token per row since the function is VOLATILE).
update public.people set short_token = public.gen_short_token() where short_token is null;

alter table public.people
  alter column short_token set not null,
  alter column short_token set default public.gen_short_token();

create unique index if not exists people_short_token_key on public.people (short_token);
