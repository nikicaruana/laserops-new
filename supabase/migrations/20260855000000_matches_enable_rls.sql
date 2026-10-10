-- =============================================================================
-- CRITICAL SECURITY FIX: enable RLS on public.matches.
--
-- The table had `grant insert, update, delete ... to authenticated` but RLS was
-- NEVER enabled, so the matches_admin_all policy was dormant and row access was
-- ungated. That let ANY logged-in user modify or DELETE ANY game with a direct
-- PostgREST call (e.g. .from("matches").delete().eq("id", X)) - bypassing the
-- create_player_match / delete_player_match RPCs that enforce creator + status.
-- Reported in the wild: a non-creator deleted games they did not organise.
--
-- Fix: enable RLS, keep a public read policy so reads are unchanged, and give
-- NO non-admin write policy - so every non-admin write must go through the
-- SECURITY DEFINER RPCs (which check ownership). Admins keep full access via
-- matches_admin_all. SECURITY DEFINER functions (create_player_match,
-- delete_player_match, the before-write triggers, etc.) run as the table owner
-- and bypass RLS, so they are unaffected.
-- =============================================================================
alter table public.matches enable row level security;

-- Reads unchanged: matches were world-readable before (RLS off); preserve that.
grant select on public.matches to anon, authenticated;
drop policy if exists matches_public_read on public.matches;
create policy matches_public_read on public.matches
  for select to anon, authenticated using (true);

-- Admin full read/write (re-assert under RLS).
drop policy if exists matches_admin_all on public.matches;
create policy matches_admin_all on public.matches
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- NO non-admin insert/update/delete policy on purpose: those go through the
-- ownership-checking RPCs only.
