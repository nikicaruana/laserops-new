-- =============================================================================
-- In-match round scores (Beta)
-- -----------------------------------------------------------------------------
-- Players who have signed into a live game (and admins) get a per-round
-- scoreboard between rounds, populated as the admin uploads each round's JSON.
-- The heavy work (parse + v2 scoring + streaks) is done ONCE per round and the
-- result cached on the round row, so player reads are instant SELECTs — the
-- break between rounds is short, so nothing may re-parse on the read path.
--
--   report          — cached compact per-round scoreboard payload (jsonb)
--   report_built_at — when that cache was built (null = needs (re)building)
--
-- The server builds this with the service client (it must read every player's
-- account + all rounds' raw files), so service_role needs explicit grants here
-- (see [[service-role-table-grants]]).
-- =============================================================================

alter table public.match_ingest_rounds add column if not exists report          jsonb;
alter table public.match_ingest_rounds add column if not exists report_built_at  timestamptz;

-- The in-match scoreboard is built server-side by the service client:
--  - match_ingest_rounds: read raw rounds + read/write the cached report
--  - accounts:            resolve headband -> ops tag / avatar (resolveRoster)
--  - streak_definitions:  optional admin streak names/points for display
grant select, insert, update on public.match_ingest_rounds to service_role;
grant select                 on public.accounts            to service_role;
grant select                 on public.streak_definitions  to service_role;
