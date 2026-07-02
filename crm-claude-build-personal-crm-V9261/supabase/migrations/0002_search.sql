-- match_people: semantic retrieval over people who have an embedding.
-- Returns rows above the caller-supplied similarity floor, ranked by cosine.
-- The floor is supplied by the caller (single source of truth lives in env).
--
-- candidate_ids: optional pre-filter. When non-null, only those people are
-- ranked (this implements "filter-then-rank" — structured filters narrow
-- the candidate set, semantic ranking orders within it).

create or replace function public.match_people(
  query_embedding vector(1536),
  similarity_floor real,
  match_limit integer default 50,
  candidate_ids uuid[] default null
)
returns table (
  id uuid,
  similarity real
)
language sql
stable
security invoker
as $$
  select p.id,
         1 - (p.semantic_embedding <=> query_embedding) as similarity
    from public.people p
   where p.owner_id = auth.uid()
     and p.semantic_embedding is not null
     and (candidate_ids is null or p.id = any(candidate_ids))
     and (1 - (p.semantic_embedding <=> query_embedding)) >= similarity_floor
   order by p.semantic_embedding <=> query_embedding
   limit match_limit;
$$;
