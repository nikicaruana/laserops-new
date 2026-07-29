-- =============================================================================
-- RLS chunk 2: denormalize display fields into the public read-models
-- =============================================================================
-- Goal: the public 2.0 site renders leaderboards / ratings / gun stats / Hall of
-- Fame WITHOUT ever querying `accounts` (which stays PII-locked). So each
-- read-model carries its own copy of the player's display name (ops_tag ->
-- nickname) and profile_pic_url, kept fresh by the refresh functions. The
-- refresh functions become SECURITY DEFINER so a full recompute always reads
-- every account regardless of the RLS that chunk 3 puts on `accounts`.
--
-- After pushing this, re-run the refreshes to populate the new columns:
--   select refresh_player_stats_lifetime();
--   select refresh_player_ratings();
--   select refresh_leaderboard_period_stats();
--   select refresh_player_gun_stats();
--   select refresh_season_challenge_standings();
-- =============================================================================

-- 1. New denormalized columns (nulls until a refresh runs) -------------------
alter table public.player_stats_lifetime     add column if not exists nickname text;
alter table public.player_stats_lifetime     add column if not exists profile_pic_url text;
alter table public.leaderboard_period_stats   add column if not exists nickname text;
alter table public.leaderboard_period_stats   add column if not exists profile_pic_url text;
alter table public.player_gun_stats           add column if not exists nickname text;
alter table public.player_gun_stats           add column if not exists profile_pic_url text;
alter table public.player_ratings             add column if not exists nickname text;
alter table public.player_ratings             add column if not exists profile_pic_url text;

-- 2. Refresh functions: carry display fields + run as definer ----------------

create or replace function public.refresh_player_stats_lifetime()
returns integer language plpgsql
security definer set search_path = public as $$
declare n integer;
begin
  delete from public.player_stats_lifetime;
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
  delete from public.leaderboard_period_stats;
  insert into public.leaderboard_period_stats (
    account_id, nickname, profile_pic_url, period_type, period_key, games, rounds, wins, losses, win_rate,
    total_kills, total_deaths, total_hits, total_shots, total_wounds, total_damage, total_score,
    kills_per_round, deaths_per_round, damage_per_round, score_per_round,
    avg_accuracy, avg_kd, avg_match_rating, updated_at)
  select
    x.account_id, a.ops_tag, a.profile_pic_url, x.period_type, x.period_key,
    count(*), sum(x.round_count),
    count(*) filter (where x.was_winner),
    count(*) filter (where x.was_winner is not true),
    round(count(*) filter (where x.was_winner)::numeric / nullif(count(*),0), 4),
    sum(x.frags), sum(x.deaths), sum(x.hits), sum(x.shots), sum(x.wounds), sum(x.damage), sum(x.score),
    round(sum(x.frags)::numeric  / nullif(sum(x.round_count),0), 3),
    round(sum(x.deaths)::numeric / nullif(sum(x.round_count),0), 3),
    round(sum(x.damage)          / nullif(sum(x.round_count),0), 2),
    round(sum(x.score)           / nullif(sum(x.round_count),0), 2),
    round(avg(x.accuracy), 4), round(avg(x.kd), 3), round(avg(x.match_rating), 2), now()
  from (
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
    select mpa.frags, mpa.deaths, mpa.hits, mpa.shots, mpa.wounds, mpa.damage, mpa.score,
           mpa.accuracy, mpa.kd, mpa.match_rating, mpa.was_winner, mpa.account_id, m.round_count,
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
  delete from public.player_gun_stats;
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
  delete from public.player_ratings;
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

-- 3. Hall of Fame views: source display fields from player_stats_lifetime -----
--    (no accounts join anywhere -> PII-free, public-safe). ops_tag column name
--    kept for site compatibility; now carries the current nickname.
--    Dropped + recreated (not CREATE OR REPLACE) because the new profile_pic_url
--    column lands mid-list, which replace-in-place forbids.

drop view if exists public.v_hof_accolade_leaders;
drop view if exists public.v_hof_all_time_records;
drop view if exists public.v_hof_season_champions;

create or replace view public.v_hof_accolade_leaders as
select
  d.name             as accolade,
  d.xp               as tier,
  psl.account_id,
  psl.nickname       as ops_tag,
  psl.profile_pic_url,
  count(*)           as times_won,
  rank() over (partition by d.id order by count(*) desc) as rk
from public.match_awards ma
join public.accolade_definitions d on ma.accolade_definition_id = d.id
join public.player_stats_lifetime psl on ma.account_id = psl.account_id
group by d.id, d.name, d.xp, psl.account_id, psl.nickname, psl.profile_pic_url;

create or replace view public.v_hof_all_time_records as
with base as (
  select mpa.account_id, psl.nickname as ops_tag, psl.profile_pic_url, m.match_code,
         mpa.score, mpa.frags, mpa.kd, mpa.accuracy, mpa.damage, mpa.match_rating, mpa.shots
  from public.match_player_aggregate mpa
  join public.player_stats_lifetime psl on mpa.account_id = psl.account_id
  join public.matches m on mpa.match_id = m.id
),
metrics as (
  select 'Highest Score'     as record, ops_tag, profile_pic_url, account_id, score::numeric as value, match_code from base where score        > 0
  union all
  select 'Most Kills',           ops_tag, profile_pic_url, account_id, frags::numeric,        match_code from base where frags        > 0
  union all
  select 'Best K/D',             ops_tag, profile_pic_url, account_id, kd,                    match_code from base where frags        > 20
  union all
  select 'Highest Accuracy',     ops_tag, profile_pic_url, account_id, accuracy,             match_code from base where shots        > 250
  union all
  select 'Most Damage',          ops_tag, profile_pic_url, account_id, damage,               match_code from base where damage       > 0
  union all
  select 'Highest Match Rating', ops_tag, profile_pic_url, account_id, match_rating,         match_code from base where match_rating > 0
),
best_per_player as (
  select *, row_number() over (partition by record, account_id order by value desc) as pr
  from metrics
)
select record, ops_tag, profile_pic_url, value, match_code,
       rank() over (partition by record order by value desc) as rk
from best_per_player
where pr = 1;

create or replace view public.v_hof_season_champions as
select scs.season_number, s.name as season_name, scs.challenge_number, c.challenge_name,
       scs.rank, scs.nickname, psl.profile_pic_url, scs.metric_value, scs.match_code
from public.season_challenge_standings scs
join public.seasons s    on s.operator_id = scs.operator_id and s.season_number = scs.season_number and s.status = 'completed'
join public.challenges c on c.operator_id = scs.operator_id and c.season_number = scs.season_number and c.challenge_number = scs.challenge_number
left join public.player_stats_lifetime psl on psl.account_id = scs.account_id
where scs.is_prize_winning
order by scs.season_number, scs.challenge_number, scs.rank;
