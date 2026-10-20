-- 20261020000000_match_roster_public.sql
-- Let players see who's signed up for a game BEFORE signing up themselves (so
-- they don't have to sign up and back out just to peek at the roster).
-- match_signups_for_organizer is gated to the owner / admin / signed-up players
-- and also returns payment fields, so it can't be opened up. This is a public
-- roster: identity-only columns (ops_tag, avatar, level, rank badge, status) -
-- all of which are already shown publicly on leaderboards - no payment data.
-- Any authenticated viewer can read the roster of an OPEN game; a PRIVATE game's
-- roster stays visible only to its owner / admin / signed-up members (returns no
-- rows otherwise), matching the existing invite-only behaviour.
create or replace function public.match_roster(p_match_id uuid)
returns table (
  ops_tag text, profile_pic_url text, level integer, rank_badge_url text, status text
)
language plpgsql stable security definer set search_path = public as $$
declare
  acct      uuid := public.current_account_id();
  m_private boolean;
  m_owner   uuid;
begin
  select is_private, created_by into m_private, m_owner
    from public.matches where id = p_match_id;

  if m_private
     and m_owner is distinct from acct
     and not public.is_admin()
     and not exists (
       select 1 from public.match_signups s
       where s.match_id = p_match_id and s.account_id = acct and s.status <> 'cancelled'
     )
  then
    return; -- private game, non-member: no roster
  end if;

  return query
    select a.ops_tag, a.profile_pic_url, psl.current_level, rl.badge_url, s.status
    from public.match_signups s
    join public.accounts a on a.id = s.account_id
    left join public.player_stats_lifetime psl on psl.account_id = s.account_id
    left join public.rank_levels rl on rl.level = psl.current_level
    where s.match_id = p_match_id and s.status in ('registered', 'waitlisted')
    order by (s.status = 'waitlisted'), s.created_at;
end;
$$;

grant execute on function public.match_roster(uuid) to authenticated;
