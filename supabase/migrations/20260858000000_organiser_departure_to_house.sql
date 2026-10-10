-- =============================================================================
-- Fix: a departing organiser's OPEN game becomes a LaserOps HOUSE game
-- (created_by NULL) - it is NEVER handed to a player. Previously
-- handle_organiser_departure transferred created_by to "the earliest remaining
-- registered player" when the organiser left. For admin-created open games
-- (created_by = the admin), the admin un-registering handed the game to the
-- first signup, who then became the owner and could DELETE it. Open games are
-- LaserOps-organised; players must never gain ownership/delete rights.
-- =============================================================================
create or replace function public.handle_organiser_departure()
returns trigger language plpgsql security definer set search_path = public as $$
declare m record;
begin
  -- Only act when a REGISTERED signup leaves (status moves off registered, or the row is deleted).
  if tg_op = 'UPDATE' and not (old.status = 'registered' and new.status is distinct from 'registered') then
    return null;
  end if;
  if tg_op = 'DELETE' and old.status is distinct from 'registered' then
    return null;
  end if;

  select id, created_by, status into m from public.matches where id = old.match_id;
  if m.id is null or m.status not in ('tentative', 'awaiting_confirm', 'confirmed') then return null; end if;
  -- Only when the person leaving is the current organiser.
  if m.created_by is distinct from old.account_id then return null; end if;

  -- The organiser left. The game carries on as a LaserOps house game; it is NOT
  -- transferred to a player (no player may own/delete an open game).
  update public.matches set created_by = null where id = m.id;
  return null;
end;
$$;

-- Backfill: reclaim LaserOps-titled open games currently owned by a NON-admin
-- (wrongly transferred, or player-created pre-restriction) so no player keeps a
-- Delete button. They become house games ("Organised by LaserOps"). Games with
-- custom player titles are intentionally left for the admin to review/delete.
update public.matches
   set created_by = null
 where is_private = false
   and status in ('tentative', 'awaiting_confirm', 'confirmed', 'live')
   and title ilike 'LaserOps Open Match%'
   and created_by is not null
   and created_by in (select id from public.accounts where not coalesce(is_admin, false));
