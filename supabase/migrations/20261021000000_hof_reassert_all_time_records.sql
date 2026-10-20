-- 20261021000000_hof_reassert_all_time_records.sql
-- "Most Kills" is missing from the live Hall of Fame all-time records: the
-- deployed v_hof_all_time_records has no Most Kills branch (prod returns Best K/D
-- but no Most Kills, even though single-game frags up to 147 exist). The fix
-- migration 20260851000000 never took effect on prod (tracker drift), so
-- re-assert the full, correct view here as a fresh migration that will actually
-- run on the next `supabase db push`. Identical definition to 20260851; the only
-- point is to force it into the live database. security_invoker re-applied
-- because CREATE OR REPLACE resets it.
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
