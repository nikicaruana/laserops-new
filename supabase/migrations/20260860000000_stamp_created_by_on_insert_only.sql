-- =============================================================================
-- TRUE ROOT CAUSE of "a player who JOINS an admin/house open game becomes its
-- owner and gets a Delete button".
--
-- matches_before_write() stamped created_by = current_account_id() whenever
-- created_by was NULL and the session user was not an admin. That trigger is
-- bound BEFORE INSERT **OR UPDATE** on public.matches. A house game has
-- created_by NULL. When a non-admin JOINS it, the sync_match_quorum trigger runs
-- `update public.matches set registered_count = ... where id = mid`. That UPDATE
-- re-fires matches_before_write inside the joiner's PostgREST session (where
-- current_account_id() = the joiner and is_admin() = false), so created_by gets
-- stamped to the joiner. They then own the game and see the Delete button.
--
-- SECURITY DEFINER does not help: current_account_id() reads the request JWT
-- claim, which stays the joiner throughout their request.
--
-- Fix: only stamp created_by on INSERT. A house game (created_by NULL) must stay
-- NULL no matter who later triggers an UPDATE on its row.
-- =============================================================================
create or replace function public.matches_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  yr  integer;
  seq integer;
begin
  -- Stamp a personal organiser ONLY when the row is first inserted by a
  -- non-admin. Never on UPDATE: a house game (created_by NULL) stays house, and
  -- joining / quorum / status changes must never transfer ownership to whoever
  -- happened to trigger the update. Admin inserts leave created_by NULL.
  if tg_op = 'INSERT' and new.created_by is null and not public.is_admin() then
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

-- Backfill: reclaim LaserOps-titled open games currently owned by a NON-admin
-- (wrongly stamped to a joiner by the old UPDATE path) back to house games
-- (created_by NULL = "Organised by LaserOps"). The "LaserOps Open Match%" title
-- is the admin CreateMatchForm default; player-created games use the player's
-- own title, so legitimate player games are not touched.
update public.matches
   set created_by = null
 where is_private = false
   and status in ('tentative', 'awaiting_confirm', 'confirmed', 'live')
   and title ilike 'LaserOps Open Match%'
   and created_by is not null
   and created_by in (select id from public.accounts where not coalesce(is_admin, false));
