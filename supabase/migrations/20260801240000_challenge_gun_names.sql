-- =============================================================================
-- Surface the GUN NAMES behind a gun_threshold_count challenge (e.g. Gunslingers)
-- instead of only the count. We store the qualifying gun names (best gun first)
-- in a new metric_detail array on the standings, computed in the same pass that
-- counts them. Only gun_threshold_count rows fill it; the other modes leave null.
-- Re-run refresh_season_challenge_standings() (a recompute) to populate it.
-- =============================================================================

alter table public.season_challenge_standings add column if not exists metric_detail text[];

create or replace function public.refresh_season_challenge_standings()
returns integer
language plpgsql as $$
declare op uuid := '00000000-0000-0000-0000-000000000001'; n int;
begin
  delete from public.season_challenge_standings;

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
