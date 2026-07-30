-- =============================================================================
-- leaderboard_period_stats — add rounds_won / rounds_lost roll-up
-- =============================================================================
-- The Match/Round Wins leaderboard needs the round win/loss split per period
-- (to compute Round Win Rate = rounds_won / (rounds_won + rounds_lost)). The
-- table already carried match wins/losses and total round_count, but not the
-- won-vs-lost split. match_player_aggregate stores rounds_won / rounds_lost per
-- player-match, so we just sum them into the period roll-up.
--
-- Additive change: two nullable columns + a refreshed function body. Re-run
-- refresh_leaderboard_period_stats() after applying to populate them.
-- =============================================================================

alter table public.leaderboard_period_stats
  add column if not exists rounds_won  integer,
  add column if not exists rounds_lost integer;

create or replace function public.refresh_leaderboard_period_stats()
returns integer language plpgsql
security definer set search_path = public as $$
declare n integer;
begin
  delete from public.leaderboard_period_stats;
  insert into public.leaderboard_period_stats (
    account_id, nickname, profile_pic_url, period_type, period_key, games, rounds, wins, losses, win_rate,
    rounds_won, rounds_lost,
    total_kills, total_deaths, total_hits, total_shots, total_wounds, total_damage, total_score,
    kills_per_round, deaths_per_round, damage_per_round, score_per_round,
    avg_accuracy, avg_kd, avg_match_rating, updated_at)
  select
    x.account_id, a.ops_tag, a.profile_pic_url, x.period_type, x.period_key,
    count(*), sum(x.round_count),
    count(*) filter (where x.was_winner),
    count(*) filter (where x.was_winner is not true),
    round(count(*) filter (where x.was_winner)::numeric / nullif(count(*),0), 4),
    sum(x.rounds_won), sum(x.rounds_lost),
    sum(x.frags), sum(x.deaths), sum(x.hits), sum(x.shots), sum(x.wounds), sum(x.damage), sum(x.score),
    round(sum(x.frags)::numeric  / nullif(sum(x.round_count),0), 3),
    round(sum(x.deaths)::numeric / nullif(sum(x.round_count),0), 3),
    round(sum(x.damage)          / nullif(sum(x.round_count),0), 2),
    round(sum(x.score)           / nullif(sum(x.round_count),0), 2),
    round(avg(x.accuracy), 4), round(avg(x.kd), 3), round(avg(x.match_rating), 2), now()
  from (
    select mpa.frags, mpa.deaths, mpa.hits, mpa.shots, mpa.wounds, mpa.damage, mpa.score,
           mpa.accuracy, mpa.kd, mpa.match_rating, mpa.was_winner, mpa.account_id, m.round_count,
           mpa.rounds_won, mpa.rounds_lost,
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
    select mpa.frags, mpa.deaths, mpa.hits, mpa.shots, mpa.wounds, mpa.damage, mpa.score,
           mpa.accuracy, mpa.kd, mpa.match_rating, mpa.was_winner, mpa.account_id, m.round_count,
           mpa.rounds_won, mpa.rounds_lost,
           'season', s.season_number::text
    from public.match_player_aggregate mpa
    join public.matches m on mpa.match_id = m.id
    join public.seasons s on m.played_on between s.starts_on and s.ends_on
    where mpa.account_id is not null and m.played_on is not null
  ) x
  join public.accounts a on a.id = x.account_id
  group by x.account_id, a.ops_tag, a.profile_pic_url, x.period_type, x.period_key;
  get diagnostics n = row_count; return n;
end;
$$;
