-- =============================================================================
-- Per-gun stock + stock-aware advance booking. `guns.stock` is the number of
-- physical units available (null = unlimited). A gun is "fully booked" for a
-- game when the count of registered signups that booked it reaches its stock.
--   * match_gun_availability(match) → per-gun stock + booked count (drives the
--     carousel's "Fully booked" state).
--   * book_match_gun(match, gun)    → atomically re-checks stock (advisory lock
--     so two players can't grab the last one) before saving booked_gun.
-- =============================================================================

alter table public.guns add column if not exists stock integer;

-- Per-gun booked counts for a match (booked = registered signups holding it).
create or replace function public.match_gun_availability(p_match_id uuid)
returns table (name text, stock integer, booked integer)
language sql stable security definer set search_path = public as $$
  select g.name, g.stock,
    (select count(*)::int from public.match_signups s
       where s.match_id = p_match_id and s.booked_gun = g.name and s.status = 'registered')
  from public.guns g;
$$;
grant execute on function public.match_gun_availability(uuid) to authenticated;

-- Book (or clear) the caller's gun for a match, enforcing stock. Returns
-- { ok: bool, error?: text }.
create or replace function public.book_match_gun(p_match_id uuid, p_gun text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  acct   uuid := public.current_account_id();
  gun    text := nullif(trim(p_gun), '');
  st     integer;
  others integer;
  updated integer;
begin
  if acct is null then return jsonb_build_object('ok', false, 'error', 'Not signed in.'); end if;

  -- Clearing the booking is always allowed.
  if gun is null then
    update public.match_signups set booked_gun = null
      where match_id = p_match_id and account_id = acct and status = 'registered';
    return jsonb_build_object('ok', true);
  end if;

  -- Serialise bookings of the same gun in the same match so the stock check and
  -- the write are atomic (prevents two people grabbing the last unit).
  perform pg_advisory_xact_lock(hashtext(p_match_id::text || ':' || gun));

  select stock into st from public.guns where name = gun limit 1;

  if st is not null then
    select count(*)::int into others from public.match_signups
      where match_id = p_match_id and booked_gun = gun and status = 'registered' and account_id <> acct;
    if others >= st then
      return jsonb_build_object('ok', false, 'error', 'That gun is fully booked for this game.');
    end if;
  end if;

  update public.match_signups set booked_gun = gun
    where match_id = p_match_id and account_id = acct and status = 'registered';
  get diagnostics updated = row_count;
  if updated = 0 then return jsonb_build_object('ok', false, 'error', 'You are not signed up to this game.'); end if;

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.book_match_gun(uuid, text) to authenticated;
