-- =============================================================================
-- Pay-after-game: the post-game settlement RPCs stamp match_participants
-- .payment_intent with the settlement method/source:
--   * admin_confirm_settlement -> 'cash' / 'revolut'
--   * settle_match_bill (full token coverage) -> 'token'
-- The original inline check only allowed ('online','on_day'), so marking a
-- player paid raised "match_participants_payment_intent_check" (and a full
-- token cover would have too). Widen it to accept the settlement values.
-- NULL still passes (hand-added linked rows insert NULL).
-- =============================================================================
alter table public.match_participants
  drop constraint if exists match_participants_payment_intent_check;
alter table public.match_participants
  add constraint match_participants_payment_intent_check
  check (payment_intent in ('online', 'on_day', 'token', 'cash', 'revolut'));
