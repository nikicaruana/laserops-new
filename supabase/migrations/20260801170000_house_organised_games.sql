-- =============================================================================
-- Admin-created games are LaserOps "house" games: the before-write trigger no
-- longer stamps created_by when the inserter is an admin, so created_by stays
-- NULL (= organised by LaserOps, not an individual). Player/RPC inserts still
-- stamp the real creator (create_player_match/create_private_booking set it
-- explicitly, so they are unaffected).
-- =============================================================================

create or replace function public.matches_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  yr  integer;
  seq integer;
begin
  -- Only stamp a personal organiser for non-admin inserts. Admin-created games
  -- stay created_by NULL and read as "organised by LaserOps".
  if new.created_by is null and not public.is_admin() then
    new.created_by := public.current_account_id();
  end if;

  if new.invite_code is null then
    new.invite_code := substr(md5(gen_random_uuid()::text), 1, 8);
  end if;

  if new.match_code is null and new.status in ('live', 'completed') then
    yr := extract(year from coalesce(new.scheduled_at, new.played_on::timestamptz, now()))::int;
    select coalesce(max(sequence_no), 0) + 1 into seq
      from public.matches
      where operator_id = new.operator_id and year = yr;
    new.year        := yr;
    new.sequence_no := seq;
    new.match_code  := 'LO-' || yr::text || '-' || lpad(seq::text, 2, '0');
  end if;

  return new;
end;
$$;
