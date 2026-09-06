-- =============================================================================
-- Live feed is player-facing + one admin global view — no anonymous/public link.
-- Restrict match_live_state reads to signed-in users (drop anon), which also
-- caps who can subscribe. (Write stays admin-only.)
-- =============================================================================
drop policy if exists match_live_state_public_read on public.match_live_state;
create policy match_live_state_auth_read on public.match_live_state
  for select to authenticated using (true);
revoke select on public.match_live_state from anon;
