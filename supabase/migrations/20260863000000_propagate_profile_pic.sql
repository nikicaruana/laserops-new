-- =============================================================================
-- Propagate a profile-picture change everywhere it's denormalized, the same way
-- an ops-tag rename already does (20260833000000). profile_pic_url is cached on
-- the stats / leaderboard read-model tables; it was only refreshed on the next
-- recompute, so a new avatar showed on the live roster (reads accounts directly)
-- but not on the summary / leaderboards (read the denormalized copy) until a
-- recompute ran. Now an avatar change syncs immediately.
--
-- profile_pic_url exists on these 5 tables; the others carry only nickname.
-- =============================================================================
create or replace function public.propagate_ops_tag_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Nickname (ops tag) change -> every table that caches the name.
  if new.ops_tag is distinct from old.ops_tag then
    update public.match_player_aggregate    set nickname = new.ops_tag where account_id = new.id;
    update public.match_awards               set nickname = new.ops_tag where account_id = new.id;
    update public.player_stats_lifetime      set nickname = new.ops_tag where account_id = new.id;
    update public.leaderboard_period_stats   set nickname = new.ops_tag where account_id = new.id;
    update public.player_gun_stats           set nickname = new.ops_tag where account_id = new.id;
    update public.player_ratings             set nickname = new.ops_tag where account_id = new.id;
    update public.player_armory              set nickname = new.ops_tag where account_id = new.id;
    update public.season_challenge_standings set nickname = new.ops_tag where account_id = new.id;
  end if;

  -- Avatar change -> every table that caches the picture.
  if new.profile_pic_url is distinct from old.profile_pic_url then
    update public.player_stats_lifetime    set profile_pic_url = new.profile_pic_url where account_id = new.id;
    update public.leaderboard_period_stats set profile_pic_url = new.profile_pic_url where account_id = new.id;
    update public.player_gun_stats         set profile_pic_url = new.profile_pic_url where account_id = new.id;
    update public.player_ratings           set profile_pic_url = new.profile_pic_url where account_id = new.id;
    update public.player_armory            set profile_pic_url = new.profile_pic_url where account_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_propagate_ops_tag on public.accounts;
create trigger trg_propagate_ops_tag
  after update of ops_tag, profile_pic_url on public.accounts
  for each row
  when (old.ops_tag is distinct from new.ops_tag or old.profile_pic_url is distinct from new.profile_pic_url)
  execute function public.propagate_ops_tag_change();

-- Backfill: sync the current avatar from accounts onto the denormalized tables
-- for every account, so pre-existing mismatches (e.g. Boulton's) are fixed now.
update public.player_stats_lifetime    t set profile_pic_url = a.profile_pic_url from public.accounts a where a.id = t.account_id and t.profile_pic_url is distinct from a.profile_pic_url;
update public.leaderboard_period_stats t set profile_pic_url = a.profile_pic_url from public.accounts a where a.id = t.account_id and t.profile_pic_url is distinct from a.profile_pic_url;
update public.player_gun_stats         t set profile_pic_url = a.profile_pic_url from public.accounts a where a.id = t.account_id and t.profile_pic_url is distinct from a.profile_pic_url;
update public.player_ratings           t set profile_pic_url = a.profile_pic_url from public.accounts a where a.id = t.account_id and t.profile_pic_url is distinct from a.profile_pic_url;
update public.player_armory            t set profile_pic_url = a.profile_pic_url from public.accounts a where a.id = t.account_id and t.profile_pic_url is distinct from a.profile_pic_url;
