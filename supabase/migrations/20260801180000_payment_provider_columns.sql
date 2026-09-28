-- =============================================================================
-- Provider-agnostic payment reference on signups, so a payment can be refunded
-- via whichever provider captured it (Stripe today, Viva later). payment_ref is
-- the provider's transaction/intent id; payment_provider names the provider.
-- Existing Stripe payments are backfilled from stripe_payment_intent.
-- =============================================================================
alter table public.match_signups
  add column if not exists payment_ref      text,
  add column if not exists payment_provider text;

update public.match_signups
  set payment_ref = stripe_payment_intent, payment_provider = 'stripe'
  where stripe_payment_intent is not null and payment_ref is null;
