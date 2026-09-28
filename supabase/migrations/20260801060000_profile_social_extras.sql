-- =============================================================================
-- Profile social extras:
--   player_squads    -> now also returns is_primary + the player's role in each
--                       squad (the profile Squads section shows both).
--   player_followers -> the list of accounts that follow a player, for the
--                       clickable "N followers" list on the summary page.
-- =============================================================================

-- Return type changes, so drop then recreate.
drop function if exists public.player_squads(text);
create or replace function public.player_squads(p_ops_tag text)
returns table (squad_id uuid, name text, badge_url text, is_primary boolean, role text)
language sql security definer set search_path = public as $$
  select s.id, s.name, s.badge_url, m.is_primary, m.role
  from public.squad_members m
  join public.squads s on s.id = m.squad_id
  join public.accounts a on a.id = m.account_id
  where lower(a.ops_tag) = lower(btrim(p_ops_tag))
  order by m.is_primary desc, s.name;
$$;
grant execute on function public.player_squads(text) to anon, authenticated;

-- Accounts that follow the given player, most recent first. Public info (the
-- follower count is already public); returns ops tag + avatar for the list.
create or replace function public.player_followers(p_ops_tag text)
returns table (ops_tag text, profile_pic_url text)
language sql security definer set search_path = public as $$
  select fa.ops_tag, fa.profile_pic_url
  from public.accounts a
  join public.follows f on f.followee_id = a.id
  join public.accounts fa on fa.id = f.follower_id
  where lower(a.ops_tag) = lower(btrim(p_ops_tag))
  order by f.created_at desc
  limit 200;
$$;
grant execute on function public.player_followers(text) to anon, authenticated;
