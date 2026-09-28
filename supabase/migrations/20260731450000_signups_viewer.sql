-- Broaden who can see a match's signup list: the creator, an admin, OR anyone
-- who is themselves signed up to the match (so signed-up players can see who
-- else is in). Ops tags only; a player still can't read raw signup rows (RLS).
create or replace function public.match_signups_for_organizer(p_match_id uuid)
returns table (ops_tag text, status text, signed_up_at timestamptz)
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
    select a.ops_tag, s.status, s.created_at
    from public.match_signups s
    join public.accounts a on a.id = s.account_id
    where s.match_id = p_match_id and s.status in ('registered', 'waitlisted')
    order by (s.status = 'waitlisted'), s.created_at;
end;
$$;
grant execute on function public.match_signups_for_organizer(uuid) to authenticated;
