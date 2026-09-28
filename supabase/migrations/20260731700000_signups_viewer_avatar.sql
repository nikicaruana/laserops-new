-- =============================================================================
-- Add the player's avatar to the organizer signup list so the "Signed up" list
-- can render proper member cards (profile pic + ops tag). Same privacy guard as
-- before (creator / admin / a signed-up player only). Return signature gains a
-- column, so the old function is dropped first (create-or-replace can't change
-- OUT columns). Level + rank badge are added in a later migration.
-- =============================================================================
drop function if exists public.match_signups_for_organizer(uuid);
create or replace function public.match_signups_for_organizer(p_match_id uuid)
returns table (ops_tag text, profile_pic_url text, status text, signed_up_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  acct  uuid := public.current_account_id();
  owner uuid;
begin
  select created_by into owner from public.matches where id = p_match_id;
  if owner is distinct from acct
     and not public.is_admin()
     and not exists (
       select 1 from public.match_signups s
       where s.match_id = p_match_id and s.account_id = acct and s.status <> 'cancelled'
     )
  then
    raise exception 'Not allowed.';
  end if;

  return query
    select a.ops_tag, a.profile_pic_url, s.status, s.created_at
    from public.match_signups s
    join public.accounts a on a.id = s.account_id
    where s.match_id = p_match_id and s.status in ('registered', 'waitlisted')
    order by (s.status = 'waitlisted'), s.created_at;
end;
$$;
grant execute on function public.match_signups_for_organizer(uuid) to authenticated;
