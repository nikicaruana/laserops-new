-- =============================================================================
-- Fix a regression from 20261024010000 (match-code race fix): that migration
-- rewrote matches_before_write() from an older base and dropped two behaviours
-- the live trigger had:
--   1. Minting invite_code on insert  -> new games had NO invite link.
--   2. Stamping created_by only on INSERT by a non-admin -> dropping it
--      reintroduced the bug where a player who JOINS a house/open game (an UPDATE
--      re-fires the trigger in the joiner's session) gets stamped as its owner,
--      and admin-created house games wrongly got created_by set to the admin.
--
-- Restore both, keeping the race-fix match_code logic (advisory lock +
-- walk-forward). Then backfill invite_code, and reclaim any house games wrongly
-- re-owned since the regression.
-- =============================================================================

create or replace function public.matches_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  yr  integer;
  seq integer;
begin
  -- Organiser: only on INSERT by a non-admin. Never on UPDATE (joining / quorum
  -- / status changes must not transfer ownership), and admin inserts stay NULL
  -- (house games = "Organised by LaserOps").
  if tg_op = 'INSERT' and new.created_by is null and not public.is_admin() then
    new.created_by := public.current_account_id();
  end if;

  -- Shareable invite link code, minted once on insert.
  if new.invite_code is null then
    new.invite_code := substr(md5(gen_random_uuid()::text), 1, 8);
  end if;

  -- LO-YYYY-NN match code, assigned when the match goes live/completed.
  -- Serialised per (operator, year) so concurrent go-lives cannot collide, with
  -- a walk-forward past any already-taken code.
  if new.match_code is null and new.status in ('live', 'completed') then
    yr := extract(year from coalesce(new.scheduled_at, new.played_on::timestamptz, now()))::int;
    perform pg_advisory_xact_lock(
      hashtextextended('match_seq:' || coalesce(new.operator_id::text, '') || ':' || yr::text, 0)
    );
    select coalesce(max(sequence_no), 0) + 1 into seq
      from public.matches
      where operator_id is not distinct from new.operator_id and year = yr;
    while exists (
      select 1 from public.matches
      where operator_id is not distinct from new.operator_id
        and match_code = 'LO-' || yr::text || '-' || lpad(seq::text, 2, '0')
    ) loop
      seq := seq + 1;
    end loop;
    new.year        := yr;
    new.sequence_no := seq;
    new.match_code  := 'LO-' || yr::text || '-' || lpad(seq::text, 2, '0');
  end if;

  return new;
end;
$$;

-- Backfill invite_code for any match minted without one during the regression.
update public.matches
  set invite_code = substr(md5(gen_random_uuid()::text), 1, 8)
  where invite_code is null;

-- Reclaim house open games wrongly re-owned by a non-admin since the regression
-- (same rule as 20260860000000): the "LaserOps Open Match%" title is the admin
-- CreateMatchForm default; player-created games keep their own title.
update public.matches
   set created_by = null
 where is_private = false
   and status in ('tentative', 'awaiting_confirm', 'confirmed', 'live')
   and title ilike 'LaserOps Open Match%'
   and created_by is not null
   and created_by in (select id from public.accounts where not coalesce(is_admin, false));
