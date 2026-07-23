-- =============================================================================
-- Season challenge standings engine + Season Champions view
-- =============================================================================
-- Ranks players for every challenge, scoped to the season's date window, per
-- the three source modes, with tiebreaks, excluding unclaimed "Head ##" (null
-- account_id) and prize-ineligible players (excluded_players). Display name and
-- exclusion use the account's current ops_tag.
--   period_summed  : sum metric over season (XP_Total / Rounds_Won)
--   match_top      : best single match of a metric (one row per player)
--   gun_threshold_count : # of distinct guns with >= threshold kills over season
-- refresh_season_challenge_standings() recomputes; re-run after new games.
-- =============================================================================

create table public.season_challenge_standings (
  operator_id      uuid not null default '00000000-0000-0000-0000-000000000001'
                     references public.operators(id) on delete cascade,
  season_number    integer not null,
  challenge_number integer not null,
  account_id       uuid not null references public.accounts(id) on delete cascade,
  nickname         text,
  rank             integer,
  metric_value     numeric,
  tiebreak_value   numeric,
  match_code       text,
  is_prize_winning boolean,
  updated_at       timestamptz not null default now(),
  primary key (season_number, challenge_number, account_id)
);
create index scs_lookup_idx on public.season_challenge_standings (season_number, challenge_number, rank);

create or replace function public.refresh_season_challenge_standings()
returns integer
language plpgsql as $$
declare op uuid := '00000000-0000-0000-0000-000000000001'; n int;
begin
  delete from public.season_challenge_standings;

  -- ---- period_summed (XP_Total, Rounds_Won) --------------------------------
  insert into public.season_challenge_standings
    (operator_id, season_number, challenge_number, account_id, nickname, rank, metric_value, tiebreak_value, match_code, is_prize_winning)
  select op, season_number, challenge_number, account_id, nickname, rk, metric_value, tiebreak_value, null, rk <= prize_cutoff
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
    (operator_id, season_number, challenge_number, account_id, nickname, rank, metric_value, tiebreak_value, match_code, is_prize_winning)
  select op, season_number, challenge_number, account_id, nickname, rk, metric_value, tiebreak_value, match_code, rk <= prize_cutoff
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
    (operator_id, season_number, challenge_number, account_id, nickname, rank, metric_value, tiebreak_value, match_code, is_prize_winning)
  select op, season_number, challenge_number, account_id, nickname, rk, metric_value, 0, null, rk <= prize_cutoff
  from (
    select counted.*, rank() over (partition by season_number, challenge_number order by metric_value desc) as rk
    from (
      select season_number, challenge_number, prize_cutoff, account_id, max(nickname) as nickname, count(*)::numeric as metric_value
      from (
        select c.season_number, c.challenge_number, c.prize_cutoff, mpa.account_id, a.ops_tag as nickname, mpa.gun_used
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

-- Season Champions (Hall of Fame): prize-winning finishers of completed seasons
create or replace view public.v_hof_season_champions as
select scs.season_number, s.name as season_name, scs.challenge_number, c.challenge_name,
       scs.rank, scs.nickname, scs.metric_value, scs.match_code
from public.season_challenge_standings scs
join public.seasons s    on s.operator_id = scs.operator_id and s.season_number = scs.season_number and s.status = 'completed'
join public.challenges c on c.operator_id = scs.operator_id and c.season_number = scs.season_number and c.challenge_number = scs.challenge_number
where scs.is_prize_winning
order by scs.season_number, scs.challenge_number, scs.rank;
