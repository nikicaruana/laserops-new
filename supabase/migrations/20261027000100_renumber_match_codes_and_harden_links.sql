-- =============================================================================
-- Renumber the Oct 2026 games into clean chronological order, and harden stored
-- report links so a code can be reassigned without breaking in-app links.
--
-- WHY: codes used to be minted on go-live, so two started-then-cancelled test
-- games burned LO-2026-40 / LO-2026-41, and a backlog game kept the out-of-order
-- LO-2026-93. In date order the codes read 35, 36, 93, 37, 38, 39, which is ugly.
--
-- TARGET (date order -> code):
--   17 Oct 09:00  LO-2026-35  -> 35  (unchanged)
--   17 Oct 13:00  LO-2026-36  -> 36  (unchanged)
--   18 Oct 09:00  LO-2026-93  -> 37
--   24 Oct 09:00  LO-2026-37  -> 38
--   24 Oct 14:00  LO-2026-38  -> 39
--   25 Oct 14:00  LO-2026-39  -> 40
--   15 Nov (confirmed, real)  LO-2026-40 -> code cleared, re-mints on completion
--   26 Oct (cancelled test)   LO-2026-41 -> code cleared permanently
--
-- THE LINK PROBLEM: /match-report?match=<code> resolves by code, and report
-- emails already sent (all six games are < 14 days old) embed the OLD codes.
-- This is a cyclic shift: 37/38/39 each move to a different game AND those same
-- codes are reused by the game shifting in behind them, so a redirect/alias can
-- never win for a reused code (the live code always wins the lookup). Therefore:
--   * Already-SENT emails for the three reused codes (37, 38, 39) will open the
--     neighbouring game's report. That is unfixable once mail has left, and is
--     the accepted one-time cost of this renumber (no data/finance impact - all
--     of that keys off the match UUID, not the code).
--   * In-app notification links (and the emails we send from now on) are made
--     immune by pointing them at the stable match UUID instead of the code. Done
--     in step 1 below, BEFORE the renumber, while each code still maps to its
--     original game.
--   * LO-2026-93 is the one freed code that is NOT reused, so it is recorded as a
--     legacy alias on its game and old 93 links keep resolving (step 6).
-- =============================================================================

-- Stable per-game alias store for retired codes (freed and not reassigned).
alter table public.matches add column if not exists legacy_codes text[] not null default '{}';
create index if not exists matches_legacy_codes_gin on public.matches using gin (legacy_codes);

-- 1. HARDEN stored report-notification links to the stable UUID, while codes
--    still map to their original games. Covers every report notification (not
--    just the renumbered ones) so dedup stays consistent with the UUID links the
--    app emits from now on, and so 35/36 are future-proof too.
update public.notifications n
   set href = '/match-report?match=' || m.id::text
  from public.matches m
 where n.type_key in ('match_report_live', 'match_report_settle')
   and m.match_code is not null
   and n.href = '/match-report?match=' || m.match_code;

-- 2. Free the two test-game codes. The 15 Nov game (LO-2026-40) is a real
--    confirmed game: clearing its code lets it re-mint a clean number when it
--    completes. The cancelled test (LO-2026-41) stays code-less forever.
update public.matches
   set match_code = null, sequence_no = null
 where match_code in ('LO-2026-40', 'LO-2026-41');

-- 3. Shift the four games into TEMP codes first, so the final assignment below
--    can never collide with the unique (operator_id, match_code) constraint.
update public.matches set match_code = 'TMP-RENUM-37' where match_code = 'LO-2026-93';
update public.matches set match_code = 'TMP-RENUM-38' where match_code = 'LO-2026-37';
update public.matches set match_code = 'TMP-RENUM-39' where match_code = 'LO-2026-38';
update public.matches set match_code = 'TMP-RENUM-40' where match_code = 'LO-2026-39';

-- 4. Assign the final chronological codes + matching sequence_no.
update public.matches set match_code = 'LO-2026-37', sequence_no = 37, year = 2026 where match_code = 'TMP-RENUM-37';
update public.matches set match_code = 'LO-2026-38', sequence_no = 38, year = 2026 where match_code = 'TMP-RENUM-38';
update public.matches set match_code = 'LO-2026-39', sequence_no = 39, year = 2026 where match_code = 'TMP-RENUM-39';
update public.matches set match_code = 'LO-2026-40', sequence_no = 40, year = 2026 where match_code = 'TMP-RENUM-40';

-- 5. The ex-93 game is now LO-2026-37: record its old code so existing
--    /match-report?match=LO-2026-93 links (and any already-sent 93 emails) still
--    resolve to it. (37/38/39 are NOT aliased - they are live codes on other
--    games now, so a legacy entry could never be reached.)
update public.matches
   set legacy_codes = array['LO-2026-93']
 where match_code = 'LO-2026-37';
