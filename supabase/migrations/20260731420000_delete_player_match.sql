-- Let a player delete a game they created, but only before it's confirmed.
-- Definer + explicit checks (creator or admin; status tentative/awaiting_confirm)
-- so no broad DELETE policy on matches is needed. Cascades signups/participants.
create or replace function public.delete_player_match(p_match_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  acct   uuid := public.current_account_id();
  owner  uuid;
  st     text;
begin
  select created_by, status into owner, st from public.matches where id = p_match_id;
  if owner is null and st is null then
    raise exception 'Game not found.';
  end if;
  if owner is distinct from acct and not public.is_admin() then
    raise exception 'Not allowed.';
  end if;
  if st not in ('tentative', 'awaiting_confirm') then
    raise exception 'You can only delete a game before it is confirmed.';
  end if;
  delete from public.matches where id = p_match_id;
end;
$$;
grant execute on function public.delete_player_match(uuid) to authenticated;
