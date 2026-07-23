-- =============================================================================
-- player_stats_lifetime (§4.17) — per-account rolled-up stats + refresh function
-- =============================================================================
-- Derived from match_player_aggregate, one row per account that has played.
-- Per-round metrics (kills/round etc.) = totals / sum(round_count), matching the
-- 2.0 design where performance is measured per round, not per match. Legacy
-- matches fold in via their stored round_count.
--
-- Not populated by a migration — call refresh_player_stats_lifetime() to
-- (re)compute. Re-run it after importing new games. Era-aware split (Legacy vs
-- 2.0) is deferred until 2.0 data exists; for now all matches are Legacy.
-- Star rating is deferred to the Phase-1 rating engine (percentile-based).
-- =============================================================================

create table public.player_stats_lifetime (
  account_id         uuid primary key references public.accounts(id) on delete cascade,
  operator_id        uuid not null default '00000000-0000-0000-0000-000000000001'
                       references public.operators(id) on delete cascade,
  games              integer,
  rounds             integer,
  wins               integer,
  losses             integer,
  win_rate           numeric,   -- wins / games
  total_kills        integer,
  total_deaths       integer,
  total_hits         integer,
  total_shots        integer,
  total_wounds       integer,
  total_damage       numeric,
  total_score        numeric,
  kills_per_round    numeric,
  deaths_per_round   numeric,
  damage_per_round   numeric,
  score_per_round    numeric,
  avg_accuracy       numeric,
  avg_kd             numeric,
  avg_match_rating   numeric,
  current_elo        numeric,   -- from the most recent match
  current_level      integer,   -- from the most recent match
  total_xp           integer,   -- lifetime XP earned
  updated_at         timestamptz not null default now()
);

create or replace function public.refresh_player_stats_lifetime()
returns integer
language plpgsql
as $$
declare n integer;
begin
  delete from public.player_stats_lifetime;
  insert into public.player_stats_lifetime (
    account_id, games, rounds, wins, losses, win_rate,
    total_kills, total_deaths, total_hits, total_shots, total_wounds, total_damage, total_score,
    kills_per_round, deaths_per_round, damage_per_round, score_per_round,
    avg_accuracy, avg_kd, avg_match_rating, current_elo, current_level, total_xp, updated_at)
  select
    mpa.account_id,
    count(*),
    sum(m.round_count),
    count(*) filter (where mpa.was_winner),
    count(*) filter (where mpa.was_winner is not true),
    round(count(*) filter (where mpa.was_winner)::numeric / nullif(count(*),0), 4),
    sum(mpa.frags), sum(mpa.deaths), sum(mpa.hits), sum(mpa.shots), sum(mpa.wounds),
    sum(mpa.damage), sum(mpa.score),
    round(sum(mpa.frags)::numeric  / nullif(sum(m.round_count),0), 3),
    round(sum(mpa.deaths)::numeric / nullif(sum(m.round_count),0), 3),
    round(sum(mpa.damage)          / nullif(sum(m.round_count),0), 2),
    round(sum(mpa.score)           / nullif(sum(m.round_count),0), 2),
    round(avg(mpa.accuracy), 4),
    round(avg(mpa.kd), 3),
    round(avg(mpa.match_rating), 2),
    (array_agg(mpa.elo_after   order by m.played_on desc nulls last, m.sequence_no desc))[1],
    (array_agg(mpa.level_after order by m.played_on desc nulls last, m.sequence_no desc))[1],
    sum(mpa.xp_total),
    now()
  from public.match_player_aggregate mpa
  join public.matches m on mpa.match_id = m.id
  where mpa.account_id is not null
  group by mpa.account_id;
  get diagnostics n = row_count;
  return n;
end;
$$;
