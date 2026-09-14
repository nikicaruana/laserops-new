-- 20260803000001_match_scoring_mode.sql
-- Admin-chosen scoring mode for a match. Authoritative for how Publish scores it:
--   'online'  = JSON event-stream rounds (full stats)
--   'offline' = kill-only (from a .lwa and/or the kill counters of any online
--               rounds). Admins can flip this at any point (start online, switch
--               to offline mid-session).
alter table public.matches
  add column if not exists scoring_mode text not null default 'online'
    check (scoring_mode in ('online', 'offline'));
