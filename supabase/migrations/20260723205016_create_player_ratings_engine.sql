-- =============================================================================
-- Player rating engine (Ratings sheet methodology) — per-round, config-driven
-- =============================================================================
-- Replicates the sheet's Overall_Rating logic:
--   * Eligible = level >= Min_Level AND matches >= Min_Matches. If the eligible
--     POOL < Min_Eligible_Pool, nobody is rated.
--   * Each component: player's percentile-rank of the metric within the eligible
--     pool -> star via rating_brackets (2/3/4/5; ineligible/below = 0).
--   * Overall raw = sum(component_star * weight); star = round-to-nearest floored
--     at 2 (raw<2.5->2, <3.5->3, <4.5->4, else 5).
-- Metrics are PER-ROUND for 2.0 (kills/damage/score per round). Gates, weights,
-- and brackets all read live from rating_config / rating_brackets.
-- =============================================================================

-- lifetime needs rounds_won/lost for the Rounds_WL component
alter table public.player_stats_lifetime add column if not exists rounds_won  integer;
alter table public.player_stats_lifetime add column if not exists rounds_lost integer;

create or replace function public.refresh_player_stats_lifetime()
returns integer language plpgsql as $$
declare n integer;
begin
  delete from public.player_stats_lifetime;
  insert into public.player_stats_lifetime (
    account_id, games, rounds, wins, losses, win_rate,
    total_kills, total_deaths, total_hits, total_shots, total_wounds, total_damage, total_score,
    kills_per_round, deaths_per_round, damage_per_round, score_per_round,
    avg_accuracy, avg_kd, avg_match_rating, current_elo, current_level, total_xp,
    rounds_won, rounds_lost, updated_at)
  select
    mpa.account_id, count(*), sum(m.round_count),
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
  where mpa.account_id is not null
  group by mpa.account_id;
  get diagnostics n = row_count; return n;
end;
$$;

-- percentile -> star via the seeded brackets (largest min_percentile <= pr wins)
create or replace function public.rating_bracket(pr numeric)
returns integer language sql stable as $$
  select stars::int from public.rating_brackets
  where operator_id = '00000000-0000-0000-0000-000000000001'
    and min_percentile is not null and min_percentile <= pr
  order by min_percentile desc limit 1;
$$;

create table public.player_ratings (
  account_id     uuid primary key references public.accounts(id) on delete cascade,
  operator_id    uuid not null default '00000000-0000-0000-0000-000000000001'
                   references public.operators(id) on delete cascade,
  s_match_win    integer,
  s_rounds_wl    integer,
  s_kills        integer,
  s_damage       integer,
  s_score        integer,
  s_accuracy     integer,
  s_kd           integer,
  s_match_rating integer,
  rating_raw     numeric,
  rating_overall integer,
  updated_at     timestamptz not null default now()
);

create or replace function public.refresh_player_ratings()
returns integer language plpgsql as $$
declare op uuid := '00000000-0000-0000-0000-000000000001';
        min_level numeric; min_matches numeric; min_pool numeric; pool int; n int;
begin
  delete from public.player_ratings;
  select value into min_level   from public.rating_config where operator_id=op and key='Min_Level';
  select value into min_matches from public.rating_config where operator_id=op and key='Min_Matches';
  select value into min_pool    from public.rating_config where operator_id=op and key='Min_Eligible_Pool';

  select count(*) into pool from public.player_stats_lifetime
    where coalesce(current_level,0) >= min_level and coalesce(games,0) >= min_matches;
  if pool < min_pool then return 0; end if;   -- pool too small: nobody rated

  insert into public.player_ratings
    (account_id, s_match_win, s_rounds_wl, s_kills, s_damage, s_score, s_accuracy, s_kd, s_match_rating, rating_raw, rating_overall)
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
  select r.account_id, r.s_win, r.s_rounds, r.s_kills, r.s_damage, r.s_score, r.s_acc, r.s_kd, r.s_match,
         round(c.raw, 3),
         case when c.raw < 2.5 then 2 when c.raw < 3.5 then 3 when c.raw < 4.5 then 4 else 5 end
  from ranked r cross join w,
  lateral (select (r.s_win*w.w_win + r.s_rounds*w.w_rounds + r.s_kills*w.w_kills + r.s_damage*w.w_damage
                 + r.s_score*w.w_score + r.s_acc*w.w_acc + r.s_kd*w.w_kd + r.s_match*w.w_match) as raw) c;
  get diagnostics n = row_count; return n;
end;
$$;
