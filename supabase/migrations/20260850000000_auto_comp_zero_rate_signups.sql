-- =============================================================================
-- Auto-comp zero-rate players.
-- A per-player-priced game normally needs an online payment. A player whose
-- effective fee is 0 (accounts.discount_price_eur = 0 overrides the match price)
-- owes nothing, so they must be marked PAID IMMEDIATELY on sign-up and never
-- shown a pay prompt. This mirrors the comp the checkout route already does for a
-- 0-amount player who clicks Pay, but does it automatically at the source so no
-- click is needed and it fires from every entry point (sign-up, re-join, admin).
--
-- Effective fee = coalesce(discount_price_eur, match.price_eur) - the same rule
-- the checkout route uses. Token coverage is a separate pay-time path and is
-- intentionally left to the existing flow.
-- =============================================================================
create or replace function public.auto_comp_zero_rate_signup()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_mode text; v_price numeric; v_disc numeric; v_fee numeric;
begin
  -- Only a registered, not-yet-paid signup is a candidate.
  if new.status is distinct from 'registered' or new.paid_at is not null then
    return new;
  end if;

  select pricing_mode, price_eur into v_mode, v_price
    from public.matches where id = new.match_id;
  -- Only per-player-priced games carry an online fee to comp.
  if v_mode is distinct from 'per_player' or coalesce(v_price, 0) <= 0 then
    return new;
  end if;

  select discount_price_eur into v_disc
    from public.accounts where id = new.account_id;
  v_fee := coalesce(v_disc, v_price);
  if v_fee is null or v_fee > 0 then
    return new; -- they owe something: leave the normal pay flow in place
  end if;

  -- Free place: mark paid. A SECURITY DEFINER UPDATE bypasses the player's RLS /
  -- column grants (they can never set paid_at themselves). Updating only payment
  -- columns (not status/account_id) does NOT re-fire this trigger.
  update public.match_signups
     set paid_at = now(),
         paid_amount_eur = 0,
         payment_intent = 'online',
         payment_provider = 'comp'
   where id = new.id and paid_at is null;

  insert into public.financial_entries
    (direction, category, amount_eur, method, account_id, match_id, source, note)
  values
    ('payment', 'game', 0, 'comp', new.account_id, new.match_id, 'game_comp',
     'Free place (0-rate player)');

  return new;
end;
$$;

drop trigger if exists trg_auto_comp_zero_rate on public.match_signups;
create trigger trg_auto_comp_zero_rate
  after insert or update of status, account_id on public.match_signups
  for each row execute function public.auto_comp_zero_rate_signup();

-- Backfill: comp any CURRENTLY registered, unpaid, 0-rate signup on a per-player
-- game (e.g. an admin's own 0-rate place that is already showing a pay prompt),
-- and write its 0 ledger row in the same statement so it can't double-insert.
with free as (
  select s.id, s.account_id, s.match_id
  from public.match_signups s
  join public.matches  m on m.id = s.match_id
  join public.accounts a on a.id = s.account_id
  where s.status = 'registered'
    and s.paid_at is null
    and m.pricing_mode = 'per_player'
    and coalesce(m.price_eur, 0) > 0
    and coalesce(a.discount_price_eur, m.price_eur) <= 0
),
upd as (
  update public.match_signups s
     set paid_at = now(), paid_amount_eur = 0, payment_intent = 'online', payment_provider = 'comp'
    from free
   where s.id = free.id
  returning s.account_id, s.match_id
)
insert into public.financial_entries
  (direction, category, amount_eur, method, account_id, match_id, source, note)
select 'payment', 'game', 0, 'comp', account_id, match_id, 'game_comp',
       'Free place (0-rate player, backfill)'
from upd;
