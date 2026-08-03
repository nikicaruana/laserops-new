-- =============================================================================
-- match_ingest_rounds — parsed round files attached to a match, so an admin's
-- ingest preview survives a refresh. Stores the raw JSONL (source of truth,
-- so we can re-parse when the parser improves) + the cached parsed extraction
-- (jsonb) for display. This is PREVIEW/STAGING only — it does NOT write player
-- stats/XP/ELO; committing those is a separate, later step gated on real-file
-- validation. Admin-only.
-- =============================================================================

create table public.match_ingest_rounds (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null default '00000000-0000-0000-0000-000000000001'
                references public.operators(id) on delete cascade,
  match_id    uuid not null references public.matches(id) on delete cascade,
  filename    text,
  raw_file    text,   -- source JSONL, kept for re-parse
  parsed      jsonb,  -- cached parseRound() output for preview / commit
  created_at  timestamptz not null default now()
);
create index match_ingest_rounds_match_idx on public.match_ingest_rounds (match_id);

alter table public.match_ingest_rounds enable row level security;

drop policy if exists match_ingest_rounds_admin_all on public.match_ingest_rounds;
create policy match_ingest_rounds_admin_all on public.match_ingest_rounds
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.match_ingest_rounds to authenticated;
