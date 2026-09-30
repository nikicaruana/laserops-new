-- Allow 'token' as a payment_intent on match_signups. spend_tokens marks a
-- token-paid signup with payment_intent='token', but the original check
-- constraint only permitted ('online','on_day'), so paying a game with a token
-- errored ("violates check constraint match_signups_payment_intent_check").
alter table public.match_signups drop constraint if exists match_signups_payment_intent_check;
alter table public.match_signups
  add constraint match_signups_payment_intent_check
  check (payment_intent in ('online', 'on_day', 'token'));
