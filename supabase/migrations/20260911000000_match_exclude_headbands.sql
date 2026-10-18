-- 20260911000000_match_exclude_headbands.sql
-- Headbands to DROP before scoring a match: a headband that joined the event
-- stream but didn't really play (an all-zeros no-show), so it should not appear
-- as a (zero-stat) player. Previously only the offline/hybrid path could exclude;
-- this makes it a durable, match-level input the online publish path honours too.
-- Empty {} = exclude nothing (the normal case).
alter table public.matches
  add column if not exists exclude_headbands integer[] not null default '{}'::integer[];
