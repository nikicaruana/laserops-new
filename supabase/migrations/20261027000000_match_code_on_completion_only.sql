-- =============================================================================
-- Issue the LO-YYYY-NN match code only when a game is COMPLETED, not when it
-- goes live. A game that is started for testing and then cancelled used to burn
-- a number (this is how LO-2026-40 / LO-2026-41 got consumed), leaving gaps and
-- out-of-order codes. Minting at completion means a code is assigned once, to a
-- game that actually happened, so the sequence stays clean and chronological.
--
-- Everything else in matches_before_write is preserved verbatim:
--   1. created_by stamped only on INSERT by a non-admin (house games stay NULL;
--      joining must never transfer ownership).
--   2. invite_code minted once on insert.
--   3. match_code assigned with the per-(operator, year) advisory lock +
--      walk-forward from 20261024010000 / 20261026000000 - only the trigger
--      CONDITION changes, from status in ('live','completed') to just
--      'completed'.
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

  -- LO-YYYY-NN match code, assigned when the match is COMPLETED (the game
  -- actually happened). Serialised per (operator, year) so concurrent
  -- completions cannot collide, with a walk-forward past any already-taken code.
  if new.match_code is null and new.status = 'completed' then
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
