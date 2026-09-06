-- =============================================================================
-- match_ingest_rounds.resolutions — admin decisions for parse ambiguities
-- (currently same-second same-team capture pairings). Keyed by ambiguous-group
-- id: { "<time>|<team>": { assign: { "<base_id>": <player_id> }, reviewed: bool } }.
-- Consumed by the ingest preview + final scoring so the admin's choice sticks.
-- =============================================================================

alter table public.match_ingest_rounds
  add column if not exists resolutions jsonb not null default '{}'::jsonb;
