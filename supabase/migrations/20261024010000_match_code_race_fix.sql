-- =============================================================================
-- Fix: go-live could fail with
--   "duplicate key value violates unique constraint matches_operator_id_match_code_key"
--
-- matches_before_write() assigns the LO-YYYY-NN match_code when a match turns
-- live/completed, using max(sequence_no)+1. That read was unlocked, so two
-- matches transitioning concurrently (the go-live cron firing for one game while
-- an admin manually Starts another, or overlapping cron runs) both read the same
-- max and computed the SAME code -> the second hit the unique constraint and the
-- whole go-live failed. A disrupted, intermittent failure.
--
-- Fix:
--  1. Take a per-(operator, year) transaction advisory lock before computing the
--     next number, so concurrent assignments serialize instead of racing.
--  2. Walk forward to the next free number if the computed code is somehow
--     already taken (legacy/imported rows, or any edge case), so go-live can
--     never fail on a code collision again.
-- =============================================================================

create or replace function public.matches_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  yr  integer;
  seq integer;
begin
  if new.created_by is null then
    new.created_by := public.current_account_id();
  end if;

  if new.match_code is null and new.status in ('live', 'completed') then
    yr := extract(year from coalesce(new.scheduled_at, new.played_on::timestamptz, now()))::int;

    -- Serialize code assignment per (operator, year): a second match going live
    -- at the same time waits here, then reads the first one's committed number.
    perform pg_advisory_xact_lock(
      hashtextextended('match_seq:' || coalesce(new.operator_id::text, '') || ':' || yr::text, 0)
    );

    select coalesce(max(sequence_no), 0) + 1 into seq
      from public.matches
      where operator_id is not distinct from new.operator_id and year = yr;

    -- Safety net: never fail on a collision. If this code already exists for the
    -- operator (imported/legacy rows, sequence_no gaps), take the next free one.
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

-- --- Clean up sequence pollution from backlog / finance imports ---------------
-- The LO-WR-25-* finance shells (hidden from the site) and the backlog game
-- LO-2026-93 were imported with inflated sequence numbers (919-934), so the next
-- real game would have jumped to LO-2026-935. Null their sequence_no (their
-- match_code and all data are untouched) so numbering for visible games resumes
-- cleanly from LO-2026-37. If a future game ever reaches 93, the walk-forward
-- loop above skips the still-present LO-2026-93 code.
update public.matches
  set sequence_no = null
  where match_code like 'LO-WR-25-%' or match_code = 'LO-2026-93';
