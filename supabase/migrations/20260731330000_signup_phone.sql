-- =============================================================================
-- Optional phone number collected at signup (a contact number for the game).
-- Player PII — visible to admins in the Match Manager; RLS keeps players to
-- their own signup rows.
-- =============================================================================

alter table public.match_signups add column if not exists phone text;
