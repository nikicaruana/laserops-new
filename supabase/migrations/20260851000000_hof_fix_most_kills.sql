-- =============================================================================
-- Fix "Most Kills" missing from the all-time HoF records.
-- The deployed v_hof_all_time_records returned 0 rows for record='Most Kills'
-- (while Best K/D, which filters frags > 20, had 108), so the deployed view was
-- missing a working Most Kills branch despite the 20260807000013 file carrying
-- it. Re-assert the full, correct definition and re-apply security_invoker
-- (CREATE OR REPLACE resets that setting).
-- =============================================================================
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

alter view public.v_hof_all_time_records set (security_invoker = true);
