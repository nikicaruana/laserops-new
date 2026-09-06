-- =============================================================================
-- The read-model refreshers wipe-and-rebuild with a bare `delete from <table>`.
-- This project runs with a "no UPDATE/DELETE without WHERE" guard active for the
-- app role, so those bare deletes raise "DELETE requires a WHERE clause" the
-- first time recompute_read_models() is called through the app (publish /
-- recompute / the admin Recompute button). Add a no-op `where true` to each.
-- Bodies are otherwise identical to their latest definitions.
-- =============================================================================

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
    rounds_won, rounds_lost, updated_at)
  select
    mpa.account_id, a.ops_tag, a.profile_pic_url, count(*), sum(m.round_count),
    count(*) filter (where mpa.was_winner), count(*) filter (where mpa.was_winner is not true),
    round(count(*) filter (where mpa.was_winner)::numeric / nullif(count(*),0), 4),
    sum(mpa.frags), sum(mpa.deaths), sum(mpa.hits), sum(mpa.shots), sum(mpa.wounds), sum(mpa.damage), sum(mpa.score),
    round(sum(mpa.frags)::numeric  / nullif(sum(m.round_count),0), 3),
    round(sum(mpa.deaths)::numeric / nullif(sum(m.round_count),0), 3),
    round(sum(mpa.damage)          / nullif(sum(m.round_count),0), 2),
    round(sum(mpa.score)           / nullif(sum(m.round_count),0), 2),
    round(avg(mpa.accuracy), 4), round(avg(mpa.kd), 3), round(avg(mpa.match_rating), 2),
    (array_agg(mpa.elo_after   order by m.played_on desc nulls last, m.sequence_no desc))[1],
    (array_agg(mpa.level_after order by m.played_on desc nulls last, m.sequence_no desc))[1],
    sum(mpa.xp_total), sum(mpa.rounds_won), sum(mpa.rounds_lost), now()
  from public.match_player_aggregate mpa
  join public.matches m on mpa.match_id = m.id
  join public.accounts a on a.id = mpa.account_id
  where mpa.account_id is not null
  group by mpa.account_id, a.ops_tag, a.profile_pic_url;
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

create or replace function public.refresh_player_gun_stats()
returns integer language plpgsql
security definer set search_path = public as $$
declare n integer;
begin
  delete from public.player_gun_stats where true;
  insert into public.player_gun_stats (
    account_id, nickname, profile_pic_url, gun_name, games, rounds, total_kills, total_deaths, total_hits,
    total_shots, total_damage, kills_per_round, damage_per_round, avg_accuracy, avg_kd, updated_at)
  select
    mpa.account_id, a.ops_tag, a.profile_pic_url, mpa.gun_used,
    count(*), sum(m.round_count),
    sum(mpa.frags), sum(mpa.deaths), sum(mpa.hits), sum(mpa.shots), sum(mpa.damage),
    round(sum(mpa.frags)::numeric / nullif(sum(m.round_count),0), 3),
    round(sum(mpa.damage)         / nullif(sum(m.round_count),0), 2),
    round(avg(mpa.accuracy), 4), round(avg(mpa.kd), 3), now()
  from public.match_player_aggregate mpa
  join public.matches m on mpa.match_id = m.id
  join public.accounts a on a.id = mpa.account_id
  where mpa.account_id is not null and coalesce(trim(mpa.gun_used),'') <> ''
  group by mpa.account_id, a.ops_tag, a.profile_pic_url, mpa.gun_used;
  get diagnostics n = row_count; return n;
end;
$$;

create or replace function public.refresh_player_ratings()
returns integer language plpgsql
security definer set search_path = public as $$
declare op uuid := '00000000-0000-0000-0000-000000000001';
        min_level numeric; min_matches numeric; min_pool numeric; pool int; n int;
begin
  delete from public.player_ratings where true;
  select value into min_level   from public.rating_config where operator_id=op and key='Min_Level';
  select value into min_matches from public.rating_config where operator_id=op and key='Min_Matches';
  select value into min_pool    from public.rating_config where operator_id=op and key='Min_Eligible_Pool';

  select count(*) into pool from public.player_stats_lifetime
    where coalesce(current_level,0) >= min_level and coalesce(games,0) >= min_matches;
  if pool < min_pool then return 0; end if;   -- pool too small: nobody rated

  insert into public.player_ratings
    (account_id, nickname, profile_pic_url, s_match_win, s_rounds_wl, s_kills, s_damage, s_score, s_accuracy, s_kd, s_match_rating, rating_raw, rating_overall)
  with w as (
    select max(value) filter (where key='Match_Win_Rating')       as w_win,
           max(value) filter (where key='Rounds_WL_Rating')       as w_rounds,
           max(value) filter (where key='Kills_Per_Match_Rating') as w_kills,
           max(value) filter (where key='Damage_Rating')          as w_damage,
           max(value) filter (where key='Score_Rating')           as w_score,
           max(value) filter (where key='Accuracy_Rating')        as w_acc,
           max(value) filter (where key='KD_Rating')              as w_kd,
           max(value) filter (where key='Match_Rating_Rating')    as w_match
    from public.rating_config where operator_id=op
  ),
  elig as (
    select account_id, win_rate,
           coalesce(rounds_won,0)::numeric / nullif(coalesce(rounds_won,0)+coalesce(rounds_lost,0),0) as rounds_wl,
           kills_per_round, damage_per_round, score_per_round, avg_accuracy, avg_kd, avg_match_rating
    from public.player_stats_lifetime
    where coalesce(current_level,0) >= min_level and coalesce(games,0) >= min_matches
  ),
  ranked as (
    select account_id,
      public.rating_bracket(percent_rank() over (order by win_rate))         as s_win,
      public.rating_bracket(percent_rank() over (order by rounds_wl))        as s_rounds,
      public.rating_bracket(percent_rank() over (order by kills_per_round))  as s_kills,
      public.rating_bracket(percent_rank() over (order by damage_per_round)) as s_damage,
      public.rating_bracket(percent_rank() over (order by score_per_round))  as s_score,
      public.rating_bracket(percent_rank() over (order by avg_accuracy))     as s_acc,
      public.rating_bracket(percent_rank() over (order by avg_kd))           as s_kd,
      public.rating_bracket(percent_rank() over (order by avg_match_rating)) as s_match
    from elig
  )
  select r.account_id, a.ops_tag, a.profile_pic_url,
         r.s_win, r.s_rounds, r.s_kills, r.s_damage, r.s_score, r.s_acc, r.s_kd, r.s_match,
         round(c.raw, 3),
         case when c.raw < 2.5 then 2 when c.raw < 3.5 then 3 when c.raw < 4.5 then 4 else 5 end
  from ranked r
  cross join w
  join public.accounts a on a.id = r.account_id,
  lateral (select (r.s_win*w.w_win + r.s_rounds*w.w_rounds + r.s_kills*w.w_kills + r.s_damage*w.w_damage
                 + r.s_score*w.w_score + r.s_acc*w.w_acc + r.s_kd*w.w_kd + r.s_match*w.w_match) as raw) c;
  get diagnostics n = row_count; return n;
end;
$$;

create or replace function public.refresh_season_challenge_standings()
returns integer
language plpgsql as $$
declare op uuid := '00000000-0000-0000-0000-000000000001'; n int;
begin
  delete from public.season_challenge_standings where true;

  -- ---- period_summed (XP_Total, Rounds_Won) --------------------------------
  insert into public.season_challenge_standings
    (operator_id, season_number, challenge_number, account_id, nickname, rank, metric_value, tiebreak_value, match_code, is_prize_winning, metric_detail)
  select op, season_number, challenge_number, account_id, nickname, rk, metric_value, tiebreak_value, null, rk <= prize_cutoff, null
  from (
    select agg.*, rank() over (partition by season_number, challenge_number order by metric_value desc, tiebreak_value desc) as rk
    from (
      select c.season_number, c.challenge_number, c.prize_cutoff, mpa.account_id, a.ops_tag as nickname,
        sum(case c.metric when 'XP_Total' then coalesce(mpa.xp_total,0)
                          when 'Rounds_Won' then coalesce(mpa.rounds_won,0) else 0 end) as metric_value,
        case when c.tiebreak_1 = 'round_win_rate_descending'
          then sum(coalesce(mpa.rounds_won,0))::numeric
               / nullif(sum(coalesce(mpa.rounds_won,0) + coalesce(mpa.rounds_lost,0)), 0)
          else 0 end as tiebreak_value
      from public.challenges c
      join public.seasons s  on s.operator_id = op and s.season_number = c.season_number
      join public.matches m  on m.operator_id = op and m.played_on between s.starts_on and s.ends_on
      join public.match_player_aggregate mpa on mpa.match_id = m.id
      join public.accounts a on a.id = mpa.account_id
      where c.operator_id = op and c.source_mode = 'period_summed'
        and not exists (select 1 from public.excluded_players e
                        where e.operator_id = op and e.status = 'active' and lower(e.nickname) = lower(a.ops_tag))
      group by c.season_number, c.challenge_number, c.prize_cutoff, c.metric, c.tiebreak_1, mpa.account_id, a.ops_tag
    ) agg
  ) ranked;

  -- ---- match_top (best single match, e.g. most kills in one match) ---------
  insert into public.season_challenge_standings
    (operator_id, season_number, challenge_number, account_id, nickname, rank, metric_value, tiebreak_value, match_code, is_prize_winning, metric_detail)
  select op, season_number, challenge_number, account_id, nickname, rk, metric_value, tiebreak_value, match_code, rk <= prize_cutoff, null
  from (
    select best.*, rank() over (partition by season_number, challenge_number order by metric_value desc, tiebreak_value desc) as rk
    from (
      select distinct on (c.season_number, c.challenge_number, mpa.account_id)
        c.season_number, c.challenge_number, c.prize_cutoff, mpa.account_id, a.ops_tag as nickname,
        coalesce(mpa.frags,0)::numeric as metric_value,
        case when coalesce(mpa.deaths,0) = 0 then coalesce(mpa.frags,0)*1000.0
             else coalesce(mpa.frags,0)::numeric / mpa.deaths end as tiebreak_value,
        m.match_code
      from public.challenges c
      join public.seasons s  on s.operator_id = op and s.season_number = c.season_number
      join public.matches m  on m.operator_id = op and m.played_on between s.starts_on and s.ends_on
      join public.match_player_aggregate mpa on mpa.match_id = m.id
      join public.accounts a on a.id = mpa.account_id
      where c.operator_id = op and c.source_mode = 'match_top' and c.metric = 'PlayerFragsCount'
        and not exists (select 1 from public.excluded_players e
                        where e.operator_id = op and e.status = 'active' and lower(e.nickname) = lower(a.ops_tag))
      order by c.season_number, c.challenge_number, mpa.account_id, coalesce(mpa.frags,0) desc,
        (case when coalesce(mpa.deaths,0) = 0 then coalesce(mpa.frags,0)*1000.0 else coalesce(mpa.frags,0)::numeric / mpa.deaths end) desc
    ) best
  ) ranked;

  -- ---- gun_threshold_count (# guns with >= threshold kills over season) -----
  insert into public.season_challenge_standings
    (operator_id, season_number, challenge_number, account_id, nickname, rank, metric_value, tiebreak_value, match_code, is_prize_winning, metric_detail)
  select op, season_number, challenge_number, account_id, nickname, rk, metric_value, 0, null, rk <= prize_cutoff, metric_detail
  from (
    select counted.*, rank() over (partition by season_number, challenge_number order by metric_value desc) as rk
    from (
      select season_number, challenge_number, prize_cutoff, account_id, max(nickname) as nickname,
             count(*)::numeric as metric_value,
             array_agg(gun_used order by kills desc) as metric_detail
      from (
        select c.season_number, c.challenge_number, c.prize_cutoff, mpa.account_id, a.ops_tag as nickname, mpa.gun_used,
               sum(coalesce(mpa.frags,0)) as kills
        from public.challenges c
        join public.seasons s  on s.operator_id = op and s.season_number = c.season_number
        join public.matches m  on m.operator_id = op and m.played_on between s.starts_on and s.ends_on
        join public.match_player_aggregate mpa on mpa.match_id = m.id
        join public.accounts a on a.id = mpa.account_id
        where c.operator_id = op and c.source_mode = 'gun_threshold_count' and coalesce(trim(mpa.gun_used),'') <> ''
          and not exists (select 1 from public.excluded_players e
                          where e.operator_id = op and e.status = 'active' and lower(e.nickname) = lower(a.ops_tag))
        group by c.season_number, c.challenge_number, c.prize_cutoff, c.threshold, mpa.account_id, a.ops_tag, mpa.gun_used
        having sum(coalesce(mpa.frags,0)) >= c.threshold
      ) guns
      group by season_number, challenge_number, prize_cutoff, account_id
    ) counted
  ) ranked;

  get diagnostics n = row_count;
  return (select count(*) from public.season_challenge_standings);
end;
$$;
