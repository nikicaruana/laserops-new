-- 20260910000000_reingest_note_complete.sql
-- Make round ingestion "note-complete" so every game (past and future) can be
-- recomputed safely from the DB alone - the raw round JSON already lives in
-- match_ingest_rounds.raw_file; these columns capture the per-game notes that the
-- pipeline previously could not express and that otherwise live only in prompts.
--
--   counts_as_round   - false for a round scored for stats but NOT tallied in the
--                       series (e.g. a game-bugged / prematurely-ended round).
--                       The engine already honours this flag; it just had no home.
--   identity_overrides - per-round headband -> who wore it, for the case where the
--                       same headband number was used by DIFFERENT people across
--                       rounds (e.g. Head 21 = Player A in R1-2, Player B in R3-5).
--                       Shape: { "21": { "person": "<account_id | ops_tag>" } }.
--                       Empty {} = use the match-level roster (match_participants).
--                       The "gun" key is reserved for a later per-round-gun feature.
--   note              - per-round free-text narrative.
--
--   matches.processing_notes - match-level free-text narrative (the "why" behind
--                       the overrides: late joiners, router resets, ID reuse, ...).
--
-- All columns are nullable / defaulted, so existing rows and the live ingest path
-- are unchanged.

alter table public.match_ingest_rounds
  add column if not exists counts_as_round boolean not null default true,
  add column if not exists identity_overrides jsonb not null default '{}'::jsonb,
  add column if not exists note text;

alter table public.matches
  add column if not exists processing_notes text;
