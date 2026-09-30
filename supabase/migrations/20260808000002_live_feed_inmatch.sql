-- Live feed + in-match scoreboard working together.
-- The native live-ingest route runs as the service role: it must read its auth
-- token (live_ingest_config) and write the live snapshot (match_live_state).
-- Without these grants the route 401s on every push (the token read fails).
grant select, insert, update on public.live_ingest_config to service_role;
grant select, insert, update on public.match_live_state   to service_role;
