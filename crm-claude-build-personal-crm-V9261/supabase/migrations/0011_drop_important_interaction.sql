-- Drop the unused important_interaction flag from interactions. The UI for
-- marking interactions as "important" has been removed and the field was never
-- meaningfully used. Keep the rest of the row intact.
alter table public.interactions
  drop column if exists important_interaction;
