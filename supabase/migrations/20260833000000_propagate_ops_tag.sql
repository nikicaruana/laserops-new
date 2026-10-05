-- =============================================================================
-- Propagate an ops-tag (nickname) change everywhere it's denormalized.
--
-- The ops tag is cached as `nickname` on the read-model / stats tables for query
-- performance. Those are refreshed on every publish/recompute, but between a
-- rename and the next recompute they'd show the old name. This trigger updates
-- them immediately whenever accounts.ops_tag changes, so a rename is reflected
-- across stats, leaderboards, ratings, awards, armory and season standings at
-- once. (match_participants.display_name is only for accountless walk-ins, so it
-- is intentionally left alone; historical audit/notification text is not touched.)
-- =============================================================================

create or replace function public.propagate_ops_tag_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.match_player_aggregate    set nickname = new.ops_tag where account_id = new.id;
  update public.match_awards               set nickname = new.ops_tag where account_id = new.id;
  update public.player_stats_lifetime      set nickname = new.ops_tag where account_id = new.id;
  update public.leaderboard_period_stats   set nickname = new.ops_tag where account_id = new.id;
  update public.player_gun_stats           set nickname = new.ops_tag where account_id = new.id;
  update public.player_ratings             set nickname = new.ops_tag where account_id = new.id;
  update public.player_armory              set nickname = new.ops_tag where account_id = new.id;
  update public.season_challenge_standings set nickname = new.ops_tag where account_id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_propagate_ops_tag on public.accounts;
create trigger trg_propagate_ops_tag
  after update of ops_tag on public.accounts
  for each row
  when (old.ops_tag is distinct from new.ops_tag)
  execute function public.propagate_ops_tag_change();
