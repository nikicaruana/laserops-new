-- Per-round averages must divide by the rounds a player ACTUALLY played, not the
-- match's total rounds - otherwise a player who sat out rounds (e.g. Kini 3/5 in
-- LO-2026-33) gets their captures/round, hold/round, kills/round etc. understated
-- (17 caps over 8 rounds played showed as 1.7 = 17/10 instead of ~2.1 = 17/8).
--
-- match_player_aggregate now carries rounds_played (all rounds) + a new
-- online_rounds_played (online rounds only, for the objective stats). Combat
-- per-round uses rounds_played; objective (captures/hold) uses online_rounds_played.
-- Both coalesce to the match totals (round_count / online_round_count) when null,
-- so historical rows are unchanged until re-committed (= full attendance assumed).
-- Re-run refresh_player_stats_lifetime() + refresh_leaderboard_period_stats() after.

alter table public.match_player_aggregate
  add column if not exists online_rounds_played int;

create or replace function public.refresh_player_stats_lifetime()
returns integer language plpgsql
security definer set search_path = public as $$
declare n integer;
begin
  delete from public.player_stats_lifetime where true;
  insert into public.player_stats_lifetime (
    account_id, nickname, profile_pic_url, games, rounds, wins, losses, win_rate,
    total_kills, total_deaths, total_hits, total_shots, total_wounds, total_damage, total_score,
    kills_per_round, deaths_per_round, damage_per_round, score_per_round,
    avg_accuracy, avg_kd, avg_match_rating, current_elo, current_level, total_xp,
    rounds_won, rounds_lost,
    online_games, online_rounds, total_captures, total_hold_seconds, obj1_per_round, obj2_per_round,
    updated_at)
  select
    x.account_id, x.ops_tag, x.profile_pic_url, count(*), sum(coalesce(x.rounds_played, x.round_count)),
    count(*) filter (where x.was_winner), count(*) filter (where x.was_winner is not true),
    round(count(*) filter (where x.was_winner)::numeric / nullif(count(*),0), 4),
    sum(x.frags), sum(x.deaths), sum(x.hits), sum(x.shots), sum(x.wounds), sum(x.damage), sum(x.score),
    round(sum(x.frags)::numeric  / nullif(sum(coalesce(x.rounds_played, x.round_count)),0), 3),
    round(sum(x.deaths)::numeric / nullif(sum(coalesce(x.rounds_played, x.round_count)),0), 3),
    round(sum(x.damage)          / nullif(sum(coalesce(x.rounds_played, x.round_count)),0), 2),
    round(sum(x.score)           / nullif(sum(coalesce(x.rounds_played, x.round_count)),0), 2),
    round(avg(x.accuracy), 4), round(avg(x.kd), 3), round(avg(x.match_rating), 2),
    (array_agg(x.elo_after   order by x.played_on desc nulls last, x.sequence_no desc))[1],
    (array_agg(x.level_after order by x.played_on desc nulls last, x.sequence_no desc))[1],
    sum(x.xp_total), sum(x.rounds_won), sum(x.rounds_lost),
    count(*) filter (where x.is_online),
    coalesce(sum(coalesce(x.online_rounds_played, x.online_round_count)) filter (where x.is_online), 0),
    sum(x.captures)     filter (where x.is_online),
    sum(x.hold_seconds) filter (where x.is_online),
    round(sum(x.slot1_value) filter (where x.is_online) / nullif(sum(coalesce(x.online_rounds_played, x.online_round_count)) filter (where x.is_online), 0), 3),
    round(sum(x.slot2_value) filter (where x.is_online) / nullif(sum(coalesce(x.online_rounds_played, x.online_round_count)) filter (where x.is_online), 0), 3),
    now()
  from (
    select mpa.account_id, a.ops_tag, a.profile_pic_url,
           mpa.was_winner, mpa.frags, mpa.deaths, mpa.hits, mpa.shots, mpa.wounds, mpa.damage, mpa.score,
           mpa.accuracy, mpa.kd, mpa.match_rating, mpa.elo_after, mpa.level_after, mpa.xp_total,
           mpa.rounds_won, mpa.rounds_lost, mpa.captures, mpa.hold_seconds,
           mpa.rounds_played, mpa.online_rounds_played,
           m.round_count, m.played_on, m.sequence_no,
           coalesce(m.online_round_count, 0) as online_round_count,
           (coalesce(m.online_round_count, 0) > 0) as is_online,
           case gm.obj_slot1_stat
             when 'captures'     then coalesce(mpa.captures, 0)::numeric
             when 'hold_seconds' then coalesce(mpa.hold_seconds, 0)
             else 0 end as slot1_value,
           case gm.obj_slot2_stat
             when 'captures'     then coalesce(mpa.captures, 0)::numeric
             when 'hold_seconds' then coalesce(mpa.hold_seconds, 0)
             else 0 end as slot2_value
    from public.match_player_aggregate mpa
    join public.matches m on mpa.match_id = m.id
    join public.accounts a on a.id = mpa.account_id
    left join public.game_modes gm on gm.slug = m.mode_slug
    where mpa.account_id is not null
  ) x
  group by x.account_id, x.ops_tag, x.profile_pic_url;
  get diagnostics n = row_count; return n;
end;
$$;

create or replace function public.refresh_leaderboard_period_stats()
returns integer language plpgsql
security definer set search_path = public as $$
declare n integer;
begin
  delete from public.leaderboard_period_stats where true;
  insert into public.leaderboard_period_stats (
    account_id, nickname, profile_pic_url, period_type, period_key, games, rounds, wins, losses, win_rate,
    rounds_won, rounds_lost,
    total_kills, total_deaths, total_hits, total_shots, total_wounds, total_damage, total_score,
    kills_per_round, deaths_per_round, damage_per_round, score_per_round,
    avg_accuracy, avg_kd, avg_match_rating, updated_at)
  select
    x.account_id, a.ops_tag, a.profile_pic_url, x.period_type, x.period_key,
    count(*), sum(coalesce(x.rounds_played, x.round_count)),
    count(*) filter (where x.was_winner),
    count(*) filter (where x.was_winner is not true),
    round(count(*) filter (where x.was_winner)::numeric / nullif(count(*),0), 4),
    sum(x.rounds_won), sum(x.rounds_lost),
    sum(x.frags), sum(x.deaths), sum(x.hits), sum(x.shots), sum(x.wounds), sum(x.damage), sum(x.score),
    round(sum(x.frags)::numeric  / nullif(sum(coalesce(x.rounds_played, x.round_count)),0), 3),
    round(sum(x.deaths)::numeric / nullif(sum(coalesce(x.rounds_played, x.round_count)),0), 3),
    round(sum(x.damage)          / nullif(sum(coalesce(x.rounds_played, x.round_count)),0), 2),
    round(sum(x.score)           / nullif(sum(coalesce(x.rounds_played, x.round_count)),0), 2),
    round(avg(x.accuracy), 4), round(avg(x.kd), 3), round(avg(x.match_rating), 2), now()
  from (
    select mpa.frags, mpa.deaths, mpa.hits, mpa.shots, mpa.wounds, mpa.damage, mpa.score,
           mpa.accuracy, mpa.kd, mpa.match_rating, mpa.was_winner, mpa.account_id, m.round_count,
           mpa.rounds_won, mpa.rounds_lost, mpa.rounds_played,
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
           mpa.rounds_won, mpa.rounds_lost, mpa.rounds_played,
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
