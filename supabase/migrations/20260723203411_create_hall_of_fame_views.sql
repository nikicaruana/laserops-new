-- =============================================================================
-- Hall of Fame views (§ Hall of Fame) — derived, always-current
-- =============================================================================
-- Views (not tables) since they're pure display derivations over already-
-- verified data; no refresh needed. Both exclude unclaimed "Head ##" rows
-- (accounts join) — Hall of Fame is for claimed players only.
--
--   v_hof_accolade_leaders : per accolade, players ranked by times won
--   v_hof_all_time_records : per metric, each player's best single match, ranked
--
-- The site filters rk <= 3 for the top-3 podiums. Eligibility gates mirror the
-- spec (K/D needs >20 kills, accuracy needs >250 shots in the match).
-- =============================================================================

create or replace view public.v_hof_accolade_leaders as
select
  d.name                                                as accolade,
  d.xp                                                  as tier,
  a.id                                                  as account_id,
  a.ops_tag,
  count(*)                                              as times_won,
  rank() over (partition by d.id order by count(*) desc) as rk
from public.match_awards ma
join public.accolade_definitions d on ma.accolade_definition_id = d.id
join public.accounts a on ma.account_id = a.id
group by d.id, d.name, d.xp, a.id, a.ops_tag;

create or replace view public.v_hof_all_time_records as
with base as (
  select mpa.account_id, a.ops_tag, m.match_code,
         mpa.score, mpa.frags, mpa.kd, mpa.accuracy, mpa.damage, mpa.match_rating, mpa.shots
  from public.match_player_aggregate mpa
  join public.accounts a on mpa.account_id = a.id
  join public.matches  m on mpa.match_id  = m.id
),
metrics as (
  select 'Highest Score'        as record, ops_tag, account_id, score::numeric   as value, match_code from base where score        > 0
  union all
  select 'Most Kills',              ops_tag, account_id, frags::numeric,        match_code from base where frags        > 0
  union all
  select 'Best K/D',                ops_tag, account_id, kd,                    match_code from base where frags        > 20
  union all
  select 'Highest Accuracy',        ops_tag, account_id, accuracy,             match_code from base where shots        > 250
  union all
  select 'Most Damage',             ops_tag, account_id, damage,               match_code from base where damage       > 0
  union all
  select 'Highest Match Rating',    ops_tag, account_id, match_rating,         match_code from base where match_rating > 0
),
best_per_player as (
  select *, row_number() over (partition by record, account_id order by value desc) as pr
  from metrics
)
select record, ops_tag, value, match_code,
       rank() over (partition by record order by value desc) as rk
from best_per_player
where pr = 1;
