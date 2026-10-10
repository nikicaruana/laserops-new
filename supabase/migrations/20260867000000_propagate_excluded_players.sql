-- =============================================================================
-- Last rename-fragility from the sweep: excluded_players (prize-ineligibility) is
-- matched by NICKNAME, not account_id. If an excluded player renames, their new
-- name isn't on the list, so they'd silently slip the exclusion. Extend the
-- propagation trigger to also follow a rename in excluded_players (guarded so it
-- can't collide with an already-excluded new name). The table is admin config and
-- may hold non-account names too, but matching the OLD current-name to its new
-- current-name is the right thing for an account-based exclusion.
--
-- (Full sweep summary: all denormalized nickname columns + the kill matrix +
-- profile pic are already synced on rename; read-time lookups use the current
-- name which is synced; match_participants.display_name is walk-ins only;
-- email_campaign_recipients.ops_tag and in-match/round snapshots are intentional
-- point-in-time history. excluded_players was the only remaining gap.)
-- =============================================================================
create or replace function public.propagate_ops_tag_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.ops_tag is distinct from old.ops_tag then
    update public.match_player_aggregate    set nickname = new.ops_tag where account_id = new.id;
    update public.match_awards               set nickname = new.ops_tag where account_id = new.id;
    update public.player_stats_lifetime      set nickname = new.ops_tag where account_id = new.id;
    update public.leaderboard_period_stats   set nickname = new.ops_tag where account_id = new.id;
    update public.player_gun_stats           set nickname = new.ops_tag where account_id = new.id;
    update public.player_ratings             set nickname = new.ops_tag where account_id = new.id;
    update public.player_armory              set nickname = new.ops_tag where account_id = new.id;
    update public.season_challenge_standings set nickname = new.ops_tag where account_id = new.id;
    -- Rewrite the renamed player's name inside every other player's kill matrix.
    perform public.rename_in_kill_matrix(old.ops_tag, new.ops_tag);
    -- Keep an account-based prize exclusion attached across the rename.
    update public.excluded_players
       set nickname = new.ops_tag
     where lower(nickname) = lower(old.ops_tag)
       and not exists (select 1 from public.excluded_players e2 where lower(e2.nickname) = lower(new.ops_tag));
  end if;

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
