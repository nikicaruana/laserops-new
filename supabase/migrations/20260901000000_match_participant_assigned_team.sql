-- =============================================================================
-- Pre-game team assignment for the admin Team Balancer.
-- Stores the chosen team colour per participant (e.g. 'Blue' / 'Yellow');
-- null = unassigned. Written by the balancer via .update() under the existing
-- match_participants_admin_all RLS policy (admins only). Additive + dormant
-- until the Team Balancer UI ships.
-- =============================================================================
alter table public.match_participants add column if not exists assigned_team text;
