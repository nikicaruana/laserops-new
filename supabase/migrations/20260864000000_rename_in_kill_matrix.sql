-- =============================================================================
-- Rivalry tallies split across a rename.
--
-- The Rivalries tab (and match-report nemesis) key each opponent by the NICKNAME
-- string snapshotted in match_player_aggregate.killed / killed_by at ingestion
-- time. When a player renames, their name inside OTHER players' kill matrices is
-- never updated, so the renamed player shows up as TWO opponents (old + new name)
-- on everyone else's page - the rivalry is split, and A's view of B no longer
-- matches B's view of A. (The viewer's own rows are read by account_id, and their
-- own nickname column is already kept in sync, so only the opponent snapshot in
-- the JSON was stale.) Example: Glenn saw "Kyle" (19/5) and "Kkkyle" (8/15) as two
-- rivals; together 27/20, which is what Kkkyle's own page shows for Glenn.
--
-- Fix: rewrite the opponent nickname inside the kill JSON on every rename (and
-- backfill the existing split). Matching is EXACT on the whole nickname, so a
-- different player like "ChrisKyle" is never touched.
-- =============================================================================

-- Rewrite one exact opponent nickname -> another across every kill matrix.
create or replace function public.rename_in_kill_matrix(p_old text, p_new text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_old is null or p_new is null or p_old = p_new then return; end if;

  update public.match_player_aggregate mpa
     set killed = (
           select jsonb_agg(
             case when e->>'nickname' = p_old
                  then jsonb_set(e, '{nickname}', to_jsonb(p_new))
                  else e end)
           from jsonb_array_elements(mpa.killed) e)
   where mpa.killed @> jsonb_build_array(jsonb_build_object('nickname', p_old));

  update public.match_player_aggregate mpa
     set killed_by = (
           select jsonb_agg(
             case when e->>'nickname' = p_old
                  then jsonb_set(e, '{nickname}', to_jsonb(p_new))
                  else e end)
           from jsonb_array_elements(mpa.killed_by) e)
   where mpa.killed_by @> jsonb_build_array(jsonb_build_object('nickname', p_old));
end;
$$;

-- Extend the display-field propagation trigger to also fix the kill matrix on a
-- rename, so a rename never fragments rivalries again.
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

-- Backfill the known existing split (Kyle -> Kkkyle).
select public.rename_in_kill_matrix('Kyle', 'Kkkyle');
