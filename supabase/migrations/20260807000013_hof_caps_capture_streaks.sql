-- =============================================================================
-- Hall of Fame: Most Caps + Longest Capture Time records, and Streak Leaders
-- =============================================================================
--   * v_hof_all_time_records  -> add "Most Caps" (captures) and
--       "Longest Capture Time" (hold_seconds) single-game records.
--   * v_hof_streak_leaders    -> new view: per streak_key, players ranked by the
--       total number of times they have earned that streak (summed over the
--       jsonb `streaks` array on match_player_aggregate). Mirrors
--       v_hof_accolade_leaders.
-- =============================================================================

-- Output columns unchanged, so CREATE OR REPLACE keeps existing grants.
create or replace view public.v_hof_all_time_records as
with base as (
  select mpa.account_id, psl.nickname as ops_tag, psl.profile_pic_url, m.match_code,
         mpa.score, mpa.frags, mpa.kd, mpa.accuracy, mpa.damage, mpa.match_rating, mpa.shots,
         mpa.captures, mpa.hold_seconds
  from public.match_player_aggregate mpa
  join public.player_stats_lifetime psl on mpa.account_id = psl.account_id
  join public.matches m on mpa.match_id = m.id
),
metrics as (
  select 'Highest Score'        as record, ops_tag, profile_pic_url, account_id, score::numeric   as value, match_code from base where score        > 0
  union all
  select 'Most Kills',              ops_tag, profile_pic_url, account_id, frags::numeric,        match_code from base where frags        > 0
  union all
  select 'Best K/D',                ops_tag, profile_pic_url, account_id, kd,                    match_code from base where frags        > 20
  union all
  select 'Highest Accuracy',        ops_tag, profile_pic_url, account_id, accuracy,             match_code from base where shots        > 250
  union all
  select 'Most Damage',             ops_tag, profile_pic_url, account_id, damage,               match_code from base where damage       > 0
  union all
  select 'Highest Match Rating',    ops_tag, profile_pic_url, account_id, match_rating,         match_code from base where match_rating > 0
  union all
  select 'Most Caps',               ops_tag, profile_pic_url, account_id, captures::numeric,    match_code from base where captures     > 0
  union all
  select 'Longest Capture Time',    ops_tag, profile_pic_url, account_id, hold_seconds,         match_code from base where hold_seconds > 0
),
best_per_player as (
  select *, row_number() over (partition by record, account_id order by value desc) as pr
  from metrics
)
select record, ops_tag, profile_pic_url, value, match_code,
       rank() over (partition by record order by value desc) as rk
from best_per_player
where pr = 1;

-- Streak Leaders: total times each player has earned each streak. `streaks` is
-- a jsonb array of { key, count, points } written per match by the ingestion
-- commit; count is how many times the streak fired in that match, so summing it
-- across matches gives the player's all-time total for that streak_key.
create or replace view public.v_hof_streak_leaders as
with expanded as (
  select mpa.account_id,
         psl.nickname       as ops_tag,
         psl.profile_pic_url,
         (s->>'key')        as streak_key,
         coalesce((s->>'count')::int, 0) as cnt
  from public.match_player_aggregate mpa
  join public.player_stats_lifetime psl on mpa.account_id = psl.account_id
  cross join lateral jsonb_array_elements(coalesce(mpa.streaks, '[]'::jsonb)) as s
  where mpa.streaks is not null
),
per_player as (
  select streak_key, account_id, ops_tag, profile_pic_url, sum(cnt) as times_earned
  from expanded
  where streak_key is not null and streak_key <> ''
  group by streak_key, account_id, ops_tag, profile_pic_url
)
select streak_key, ops_tag, profile_pic_url, times_earned,
       rank() over (partition by streak_key order by times_earned desc) as rk
from per_player
where times_earned > 0;

grant select on public.v_hof_streak_leaders to anon, authenticated;
