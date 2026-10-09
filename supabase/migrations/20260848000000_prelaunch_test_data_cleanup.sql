-- =============================================================================
-- One-time pre-launch cleanup of STAGING TEST DATA (2026-10-09).
-- =============================================================================
-- The site never took real payments (Viva was in demo until go-live) and nobody
-- holds real tokens (token_lots was empty), so every booking / payment / token /
-- notification-feed row to date is staging test data. This removes it. Untouched:
-- all accounts, all historical games (LO-2025-*/LO-2026-*) + their aggregates /
-- awards / stats, all config (incl. notification_types + admin_notification_types).
-- Idempotent + harmless on a fresh DB (the tables are empty there).
-- =============================================================================

-- The one test booking (cascades its own signups/invites/children).
delete from public.matches where id = '7771668b-441a-4891-850c-f30b065f01dd';

-- Remaining booking-flow rows (all staging test).
delete from public.match_invites where true;
delete from public.match_signups where true;

-- Token system (all staging test; no real balances - token_lots was empty).
delete from public.token_transactions where true;
delete from public.token_purchases where true;
delete from public.token_lots where true;
delete from public.token_gifts where true;

-- Financial ledger (all demo-Viva test payments).
delete from public.financial_entries where true;

-- Notification feeds (stale staging test notifications; keep the type/templates).
delete from public.admin_notification_reads where true;
delete from public.admin_notifications where true;
delete from public.notifications where true;
