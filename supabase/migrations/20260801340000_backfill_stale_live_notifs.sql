-- =============================================================================
-- One-off: clear game_live notifications that are already stale because their
-- match has since ended (completed/cancelled). The trigger added in
-- 20260801330000 only fires on future transitions, so sweep existing rows once.
-- =============================================================================
update public.notifications nt
   set seen_at = now()
  from public.matches m
 where nt.type_key = 'game_live'
   and nt.seen_at is null
   and m.status in ('completed', 'cancelled')
   and nt.href like '/player-portal/games/' || m.id::text || '%';
