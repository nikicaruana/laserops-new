-- =============================================================================
-- Fix: unlocked guns showed the old lock text instead of the gun name.
-- =============================================================================
-- The armory card shows gun_display_title for an UNLOCKED gun, but the import
-- stored the lock-requirement text there for unlockable guns (so a now-unlocked
-- gun like P-90 showed "20,000 SMG Pts + Lvl 8"). Set gun_display_title to the
-- gun name in refresh_player_armory, and rerun to fix existing rows.
-- =============================================================================

create or replace function public.refresh_player_armory()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  -- ---- 1. per-gun performance stats ---------------------------------------
  update public.player_armory
  set matches_used = 0, kills_total = 0, avg_kills = 0, deaths_total = 0,
      hits_total = 0, shots_total = 0, damage_total = 0, avg_damage = 0,
      score_total = 0, avg_score = 0, avg_accuracy = 0, kd_ratio = 0,
      wins_using_gun = 0, rounds_won_using_gun = 0, avg_match_rating = 0,
      has_used_gun = false
  where account_id is not null;

  with agg as (
    select mpa.account_id,
           lower(trim(mpa.gun_used)) as gun_key,
           count(*)                                   as matches_used,
           sum(coalesce(mpa.frags,0))                 as kills_total,
           sum(coalesce(mpa.deaths,0))                as deaths_total,
           sum(coalesce(mpa.hits,0))                  as hits_total,
           sum(coalesce(mpa.shots,0))                 as shots_total,
           sum(coalesce(mpa.damage,0))                as damage_total,
           sum(coalesce(mpa.score,0))                 as score_total,
           count(*) filter (where mpa.was_winner)     as wins_using_gun,
           sum(coalesce(mpa.rounds_won,0))            as rounds_won_using_gun,
           avg(mpa.match_rating)                      as avg_match_rating
    from public.match_player_aggregate mpa
    where mpa.account_id is not null and coalesce(trim(mpa.gun_used),'') <> ''
    group by mpa.account_id, lower(trim(mpa.gun_used))
  )
  update public.player_armory pa
  set matches_used         = a.matches_used,
      kills_total          = a.kills_total,
      deaths_total         = a.deaths_total,
      hits_total           = a.hits_total,
      shots_total          = a.shots_total,
      damage_total         = a.damage_total,
      score_total          = a.score_total,
      avg_kills            = a.kills_total::numeric  / nullif(a.matches_used,0),
      avg_damage           = a.damage_total          / nullif(a.matches_used,0),
      avg_score            = a.score_total           / nullif(a.matches_used,0),
      avg_accuracy         = a.hits_total::numeric   / nullif(a.shots_total,0),
      kd_ratio             = a.kills_total::numeric  / nullif(a.deaths_total,0),
      wins_using_gun       = a.wins_using_gun,
      rounds_won_using_gun = a.rounds_won_using_gun,
      avg_match_rating     = coalesce(a.avg_match_rating, 0),
      has_used_gun         = true,
      updated_at           = now()
  from agg a
  where pa.account_id = a.account_id
    and lower(trim(pa.gun_name)) = a.gun_key;

  -- ---- 2. unlocks from tree XP + level ------------------------------------
  with txp as (
    select mpa.account_id, g2.tree_branch, sum(coalesce(mpa.xp_total,0))::numeric as xp
    from public.match_player_aggregate mpa
    join public.guns g2 on g2.name = mpa.gun_used
    where mpa.account_id is not null and g2.tree_branch is not null
    group by mpa.account_id, g2.tree_branch
  ),
  plvl as (
    select account_id, max(coalesce(level_after, 0)) as level
    from public.match_player_aggregate where account_id is not null group by account_id
  ),
  calc as (
    select pa.id as pa_id,
           g.name as gun_name,
           g.tree_branch, g.unlock_type,
           g.unlock_prerequisite_class as pclass, g.unlock_prerequisite_gun as pgun,
           g.unlock_requirement_points as req, g.unlock_requirement_level as reqlvl,
           g.unlock_display_text as disp,
           coalesce(l.level, 0) as lvl,
           coalesce(t.xp, 0) as treexp,
           (g.unlock_type = 'Default' or g.unlock_requirement_points is null) as is_default
    from public.player_armory pa
    join public.guns g on g.name = pa.gun_name
    left join txp  t on t.account_id = pa.account_id and t.tree_branch = g.tree_branch
    left join plvl l on l.account_id = pa.account_id
    where pa.account_id is not null
  )
  update public.player_armory pa
  set tree_branch               = c.tree_branch,
      unlock_type               = c.unlock_type,
      unlock_prereq_class       = c.pclass,
      unlock_prereq_gun         = c.pgun,
      unlock_req_points         = c.req,
      unlock_req_level          = c.reqlvl,
      unlock_display_text       = c.disp,
      gun_display_title         = c.gun_name,
      points_toward_unlock      = c.treexp,
      gun_is_unlocked           = c.is_default or (c.treexp >= coalesce(c.req, 0) and c.lvl >= coalesce(c.reqlvl, 0)),
      unlock_progress_pct       = case when c.is_default or coalesce(c.req, 0) = 0 then 1 else least(1, c.treexp / c.req) end,
      unlock_progress_remaining = greatest(0, coalesce(c.req, 0) - c.treexp),
      unlock_progress_text      = case
                                    when c.is_default then ''
                                    when c.treexp >= coalesce(c.req, 0) and c.lvl < coalesce(c.reqlvl, 0) then 'Reach Level ' || c.reqlvl
                                    else '' end,
      gun_player_status         = case when c.is_default or (c.treexp >= coalesce(c.req, 0) and c.lvl >= coalesce(c.reqlvl, 0)) then 'unlocked' else 'locked' end,
      updated_at                = now()
  from calc c
  where c.pa_id = pa.id;

  get diagnostics n = row_count;
  return n;
end;
$$;

select public.refresh_player_armory();
