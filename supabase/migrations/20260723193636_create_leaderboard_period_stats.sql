-- =============================================================================
-- leaderboard_period_stats (§4.17) — per-account stats sliced by period
-- =============================================================================
-- Keyed (account_id, period_type, period_key). period_type ∈
-- all-time | year | month | season. Powers the leaderboards' period filter.
-- Season rows come from matches whose played_on falls inside a seasons row's
-- date range (a match can count toward more than one overlapping season).
-- Per-round metrics as in player_stats_lifetime. Call
-- refresh_leaderboard_period_stats() to (re)compute; re-run after new games.
-- =============================================================================

create table public.leaderboard_period_stats (
  account_id       uuid not null references public.accounts(id) on delete cascade,
  operator_id      uuid not null default '00000000-0000-0000-0000-000000000001'
                     references public.operators(id) on delete cascade,
  period_type      text not null,   -- all-time | year | month | season
  period_key       text not null,   -- 'all' | 'YYYY' | 'YYYY-MM' | season_number
  games            integer,
  rounds           integer,
  wins             integer,
  losses           integer,
  win_rate         numeric,
  total_kills      integer,
  total_deaths     integer,
  total_hits       integer,
  total_shots      integer,
  total_wounds     integer,
  total_damage     numeric,
  total_score      numeric,
  kills_per_round  numeric,
  deaths_per_round numeric,
  damage_per_round numeric,
  score_per_round  numeric,
  avg_accuracy     numeric,
  avg_kd           numeric,
  avg_match_rating numeric,
  updated_at       timestamptz not null default now(),
  primary key (account_id, period_type, period_key)
);
create index lps_period_idx on public.leaderboard_period_stats (period_type, period_key);

create or replace function public.refresh_leaderboard_period_stats()
returns integer
language plpgsql
as $$
declare n integer;
begin
  delete from public.leaderboard_period_stats;
  insert into public.leaderboard_period_stats (
    account_id, period_type, period_key, games, rounds, wins, losses, win_rate,
    total_kills, total_deaths, total_hits, total_shots, total_wounds, total_damage, total_score,
    kills_per_round, deaths_per_round, damage_per_round, score_per_round,
    avg_accuracy, avg_kd, avg_match_rating, updated_at)
  select
    account_id, period_type, period_key,
    count(*), sum(round_count),
    count(*) filter (where was_winner),
    count(*) filter (where was_winner is not true),
    round(count(*) filter (where was_winner)::numeric / nullif(count(*),0), 4),
    sum(frags), sum(deaths), sum(hits), sum(shots), sum(wounds), sum(damage), sum(score),
    round(sum(frags)::numeric  / nullif(sum(round_count),0), 3),
    round(sum(deaths)::numeric / nullif(sum(round_count),0), 3),
    round(sum(damage)          / nullif(sum(round_count),0), 2),
    round(sum(score)           / nullif(sum(round_count),0), 2),
    round(avg(accuracy), 4), round(avg(kd), 3), round(avg(match_rating), 2), now()
  from (
    -- all-time / year / month for every player-match row
    select mpa.frags, mpa.deaths, mpa.hits, mpa.shots, mpa.wounds, mpa.damage, mpa.score,
           mpa.accuracy, mpa.kd, mpa.match_rating, mpa.was_winner, mpa.account_id, m.round_count,
           p.period_type, p.period_key
    from public.match_player_aggregate mpa
    join public.matches m on mpa.match_id = m.id
    cross join lateral (values
      ('all-time', 'all'),
      ('year',  to_char(m.played_on, 'YYYY')),
      ('month', to_char(m.played_on, 'YYYY-MM'))
    ) as p(period_type, period_key)
    where mpa.account_id is not null and m.played_on is not null
    union all
    -- season rows: match falls within a season's date range
    select mpa.frags, mpa.deaths, mpa.hits, mpa.shots, mpa.wounds, mpa.damage, mpa.score,
           mpa.accuracy, mpa.kd, mpa.match_rating, mpa.was_winner, mpa.account_id, m.round_count,
           'season', s.season_number::text
    from public.match_player_aggregate mpa
    join public.matches m on mpa.match_id = m.id
    join public.seasons s on m.played_on between s.starts_on and s.ends_on
    where mpa.account_id is not null and m.played_on is not null
  ) x
  group by account_id, period_type, period_key;
  get diagnostics n = row_count;
  return n;
end;
$$;
