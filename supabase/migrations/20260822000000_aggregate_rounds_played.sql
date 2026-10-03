-- Per-player rounds played + team round-wins while present, so match_rating can
-- be extrapolated to a full-match equivalent (partial players are not penalised)
-- and round-win XP can be capped to the rounds a player actually played.
-- Nullable: existing rows stay null and the recompute falls back to full
-- attendance (round_count) + rounds_won, so historical matches are unchanged.
alter table public.match_player_aggregate
  add column if not exists rounds_played int,
  add column if not exists rounds_won_present int;
