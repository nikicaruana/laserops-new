-- Players can request a private booking (birthday, corporate, group). Creates a
-- PRIVATE (unlisted) match as 'tentative' for an admin to price + confirm. Same
-- 3-active cap as open games. Definer so no broad matches INSERT policy is needed.
create or replace function public.create_private_booking(
  p_title        text,
  p_scheduled_at timestamptz,
  p_headcount    integer
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  acct   uuid := public.current_account_id();
  active integer;
  new_id uuid;
begin
  if acct is null then
    raise exception 'You need an account to book a game.';
  end if;

  select count(*) into active from public.matches
    where created_by = acct
      and status in ('tentative', 'awaiting_confirm', 'confirmed', 'live');
  if active >= 3 then
    raise exception 'You can have at most 3 active games/bookings at a time.';
  end if;

  insert into public.matches (
    title, scheduled_at, status, min_players, is_private, pricing_mode, created_by
  ) values (
    nullif(btrim(p_title), ''), p_scheduled_at, 'tentative',
    greatest(coalesce(p_headcount, 1), 1), true, 'flat', acct
  )
  returning id into new_id;

  return new_id;
end;
$$;
grant execute on function public.create_private_booking(text, timestamptz, integer) to authenticated;
