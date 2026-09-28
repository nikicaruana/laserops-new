-- =============================================================================
-- gameCalendarUrl: /events/open-games IS a real, built page, so it stays as the
-- destination. This reverts an earlier (mistaken) repoint to /player-portal/games
-- and is a no-op if that repoint was never applied.
-- =============================================================================
update public.email_config
set value = 'https://www.laseropsmalta.com/events/open-games'
where key = 'gameCalendarUrl'
  and value = 'https://www.laseropsmalta.com/player-portal/games';
