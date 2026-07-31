-- =============================================================================
-- Match status lifecycle v2 (admin-confirm step + quorum tracking).
-- Replaces the phase-1 status set (scheduled/confirmed/...) with the model the
-- booking system needs:
--   tentative        -> a booked slot with fewer than the quorum of players;
--                       might not happen. (default for new matches)
--   awaiting_confirm -> reached the quorum (e.g. 10); waiting on admin sign-off.
--   confirmed        -> admin signed off; it's happening (payment opens).
--   live             -> admin has started it (entry code active).
--   completed        -> finished; data ingested.
--   cancelled        -> called off.
--
-- reached_quorum_at is stamped when a match first hits the quorum, so when two
-- tentative matches compete for the same slot the admin can see which filled
-- first (earliest reached_quorum_at wins the slot; the other is bumped).
-- Existing rows are all 'completed', so no data needs remapping.
-- =============================================================================

alter table public.matches drop constraint if exists matches_status_check;

alter table public.matches
  alter column status set default 'tentative',
  add column if not exists reached_quorum_at timestamptz;

alter table public.matches
  add constraint matches_status_check check (
    status in ('tentative', 'awaiting_confirm', 'confirmed', 'live', 'completed', 'cancelled')
  );
