-- =============================================================================
-- Armory coverage: link existing rows to accounts, seed new players, recompute.
-- =============================================================================
-- player_armory came from a one-time import keyed by NICKNAME; only ~53 rows ever
-- got account_id set, so refresh_player_armory (keyed on account_id) skipped most
-- players and brand-new players had no rows at all. This:
--   1. Links existing rows to accounts by nickname = ops_tag.
--   2. ensure_player_armory(account): inserts a row per visible gun (idempotent),
--      with unlock state computed from the account's tree XP + level. A trigger
--      runs it when an account gets its ops tag (onboarding), so fresh signups get
--      a full armory.
--   3. Backfills any account still missing rows, then recomputes everyone.
-- =============================================================================

-- 1. Link import rows to accounts by current ops tag.
update public.player_armory pa
set account_id = a.id
from public.accounts a
where pa.account_id is null
  and a.ops_tag is not null
  and lower(trim(pa.nickname)) = lower(trim(a.ops_tag));

-- 2. Seeder.
create or replace function public.ensure_player_armory(p_account_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer; v_nick text; v_pic text; v_lvl integer;
begin
  if p_account_id is null then return 0; end if;
  select ops_tag into v_nick from public.accounts where id = p_account_id;
  if v_nick is null or btrim(v_nick) = '' then return 0; end if;  -- no handle yet
  select coalesce(profile_pic_url, '') into v_pic from public.player_stats_lifetime where account_id = p_account_id;
  select coalesce(max(level_after), 1) into v_lvl from public.match_player_aggregate where account_id = p_account_id;
  if v_lvl is null then v_lvl := 1; end if;

  with txp as (
    select g2.tree_branch, sum(coalesce(mpa.xp_total, 0))::numeric as xp
    from public.match_player_aggregate mpa
    join public.guns g2 on g2.name = mpa.gun_used
    where mpa.account_id = p_account_id and g2.tree_branch is not null
    group by g2.tree_branch
  )
  insert into public.player_armory (
    account_id, nickname, profile_pic_url, player_level,
    gun_name, gun_class, tree_branch, gun_used_img, gun_player_image, gun_locked_img, is_default,
    unlock_type, unlock_prereq_class, unlock_prereq_gun, unlock_req_points, unlock_req_level,
    unlock_display_text, gun_sort_order, gun_display_title,
    gun_mag_size, gun_damage, gun_reload, gun_fire_rate,
    matches_used, kills_total, avg_kills, deaths_total, hits_total, shots_total, damage_total, avg_damage,
    score_total, avg_score, avg_accuracy, kd_ratio, wins_using_gun, rounds_won_using_gun, avg_match_rating, has_used_gun,
    points_toward_unlock, gun_is_unlocked, gun_player_status,
    unlock_progress_pct, unlock_progress_remaining, unlock_progress_text
  )
  select p_account_id, v_nick, v_pic, v_lvl,
         g.name, g.class, g.tree_branch, g.image_url, g.image_url, null, g.is_default,
         g.unlock_type, g.unlock_prerequisite_class, g.unlock_prerequisite_gun, g.unlock_requirement_points, g.unlock_requirement_level,
         g.unlock_display_text, g.sort_order, g.name,
         g.mag_size, g.damage, g.reload, g.fire_rate,
         0, 0, 0, 0, 0, 0, 0, 0,
         0, 0, 0, 0, 0, 0, 0, false,
         coalesce(t.xp, 0),
         (g.unlock_type = 'Default' or g.unlock_requirement_points is null)
           or (coalesce(t.xp, 0) >= coalesce(g.unlock_requirement_points, 0) and v_lvl >= coalesce(g.unlock_requirement_level, 0)),
         case when (g.unlock_type = 'Default' or g.unlock_requirement_points is null)
                   or (coalesce(t.xp, 0) >= coalesce(g.unlock_requirement_points, 0) and v_lvl >= coalesce(g.unlock_requirement_level, 0))
              then 'unlocked' else 'locked' end,
         case when (g.unlock_type = 'Default' or g.unlock_requirement_points is null or coalesce(g.unlock_requirement_points, 0) = 0)
              then 1 else least(1, coalesce(t.xp, 0) / g.unlock_requirement_points) end,
         greatest(0, coalesce(g.unlock_requirement_points, 0) - coalesce(t.xp, 0)),
         ''
  from public.guns g
  left join txp t on t.tree_branch = g.tree_branch
  where coalesce(g.is_visible, true) = true
    and g.name <> 'Unknown Gun'
    and not exists (
      select 1 from public.player_armory pa
      where (pa.account_id = p_account_id or lower(trim(pa.nickname)) = lower(trim(v_nick)))
        and lower(trim(pa.gun_name)) = lower(trim(g.name))
    );

  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function public.ensure_player_armory(uuid) to authenticated, service_role;

-- 3. Trigger: seed when an account gets (or changes to) a non-null ops tag.
create or replace function public.seed_armory_on_ops_tag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ops_tag is not null and btrim(new.ops_tag) <> '' then
    perform public.ensure_player_armory(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_seed_armory_ops_tag on public.accounts;
create trigger trg_seed_armory_ops_tag
  after insert or update of ops_tag on public.accounts
  for each row execute function public.seed_armory_on_ops_tag();

-- 4. Backfill any account with an ops tag that is still missing rows, then
--    recompute stats + unlocks for everyone now linked.
do $$
declare r record;
begin
  for r in select id from public.accounts where ops_tag is not null and btrim(ops_tag) <> '' loop
    perform public.ensure_player_armory(r.id);
  end loop;
end $$;

select public.refresh_player_armory();
