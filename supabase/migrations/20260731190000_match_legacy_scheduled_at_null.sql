-- =============================================================================
-- Clear the fake scheduled_at on legacy games.
-- Phase-1 (20260731180000) backfilled scheduled_at = played_on::timestamptz so
-- legacy rows had something to sort by, but a date-only value renders as a
-- misleading 02:00 (UTC midnight shown in Europe/Malta). Real date/times will
-- come from the calendar/booking system; legacy games should show a date only.
-- The list still sorts these by played_on, so nothing is lost.
-- =============================================================================

update public.matches
  set scheduled_at = null
  where status = 'completed'
    and scheduled_at is not null
    and scheduled_at = played_on::timestamptz;
