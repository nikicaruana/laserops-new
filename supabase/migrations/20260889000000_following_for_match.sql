-- =============================================================================
-- Invite menu: exclude players already signed up to the game from the "invite
-- people you follow" list.
-- =============================================================================
create or replace function public.my_following_for_match(p_match_id uuid)
returns table (account_id uuid, ops_tag text, profile_pic_url text)
language sql security definer set search_path = public as $$
  select a.id, a.ops_tag, a.profile_pic_url
  from public.follows f
  join public.accounts a on a.id = f.followee_id
  where f.follower_id = public.current_account_id()
    and not exists (
      select 1 from public.match_signups s
      where s.match_id = p_match_id and s.account_id = a.id and s.status <> 'cancelled'
    )
  order by a.ops_tag;
$$;
grant execute on function public.my_following_for_match(uuid) to authenticated;
