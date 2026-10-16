-- =============================================================================
-- Pre-game team assignment for the Team Balancer when planning from signups
-- (before the match_participants roster exists at the venue). Mirrors
-- match_participants.assigned_team. Stores the chosen team colour per signup;
-- null = unassigned. Written by the balancer under the match_signups_admin_all
-- RLS policy (admins only). Additive + dormant.
-- =============================================================================
alter table public.match_signups add column if not exists assigned_team text;
