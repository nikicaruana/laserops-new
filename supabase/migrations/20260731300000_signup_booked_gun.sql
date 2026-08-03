-- =============================================================================
-- booked_gun on a signup — when a player pays online in advance they can book
-- the gun they intend to use. It pre-selects (still changeable) in the live
-- join screen. Just a stored preference; the actual gun used is on
-- match_participants.gun_used.
-- =============================================================================

alter table public.match_signups add column if not exists booked_gun text;
