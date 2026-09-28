-- =============================================================================
-- Refunds. Stores the Stripe payment reference (needed to issue a refund) and
-- the refund state on the signup. The payment guard is extended so players can't
-- forge any payment-truth column; only the Stripe webhook (service_role) and the
-- admin/cancel server routes (service_role) write these.
--   refund_status: null (none) | 'pending' (awaiting admin) | 'refunded' | 'denied'
-- =============================================================================

alter table public.match_signups
  add column if not exists stripe_payment_intent text,
  add column if not exists refunded_at           timestamptz,
  add column if not exists refunded_amount_eur   numeric,
  add column if not exists refund_status         text check (refund_status in ('pending', 'refunded', 'denied'));

-- Extend the guard: block players from writing ANY payment-truth column directly.
create or replace function public.guard_signup_paid()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.paid_at             is distinct from old.paid_at
       or new.paid_amount_eur     is distinct from old.paid_amount_eur
       or new.stripe_payment_intent is distinct from old.stripe_payment_intent
       or new.refunded_at         is distinct from old.refunded_at
       or new.refunded_amount_eur is distinct from old.refunded_amount_eur
       or new.refund_status       is distinct from old.refund_status)
  then
    raise exception 'Payment status can only be set by payment processing.';
  end if;
  return new;
end;
$$;
