-- =============================================================================
-- Match pricing mode + deposit (for private bookings).
-- Open / double-XP matches are always priced per player. A private booking can
-- be per player OR a flat lump sum (e.g. a company event), and may carry a
-- deposit. price_eur holds the number; pricing_mode says how to read it.
-- (A generated deposit payment link comes with the payments phase.)
-- =============================================================================

alter table public.matches
  add column if not exists pricing_mode text not null default 'per_player'
    check (pricing_mode in ('per_player', 'flat')),
  add column if not exists deposit_eur numeric;
