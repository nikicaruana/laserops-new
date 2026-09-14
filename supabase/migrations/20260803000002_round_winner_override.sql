-- 20260803000002_round_winner_override.sql
-- Per-round winner override for online (JSON) rounds. The parser derives the
-- round winner from base control; an admin can override it after the round
-- (e.g. AlphaTag's rate-points winner disagreeing with the base-burn result).
--   null      = use the parser-derived winner
--   'draw'    = explicitly no winner
--   <colour>  = that team won
alter table public.match_ingest_rounds
  add column if not exists winner_override text;
