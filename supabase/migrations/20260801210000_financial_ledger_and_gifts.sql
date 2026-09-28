-- =============================================================================
-- Unified financial ledger + token gifting + "record only on paid" checkout.
--
--  * financial_entries  : the SINGLE SOURCE OF TRUTH for money. Every payment or
--    refund (online token purchases, online + in-person game payments, drink
--    sales, refunds) is one typed row (direction + category + method). Online
--    events feed it automatically; admins add in-person cash + drinks by hand.
--  * checkout_intents   : pre-payment intent (what the buyer is about to pay
--    for, incl. gift details). NOT a financial record - abandoned checkouts stay
--    here and never reach the reports. The purchase + ledger rows are written
--    only when the webhook confirms payment (fixes the "pending row" clutter).
--  * token_gifts        : a gift bought for an email that has no account yet;
--    claimed after the recipient signs up.
-- =============================================================================

-- Single-token pricing (for gifting one game) lives on the token config.
alter table public.token_config
  add column if not exists single_token_price_eur      numeric(10,2) not null default 35,
  add column if not exists single_token_validity_months integer      not null default 6;

-- token lots can now originate from a gift.
alter table public.token_lots drop constraint if exists token_lots_source_check;
alter table public.token_lots add constraint token_lots_source_check
  check (source in ('purchase', 'milestone', 'refund', 'admin', 'gift'));

-- --- financial ledger -------------------------------------------------------
create table public.financial_entries (
  id          uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  direction   text not null check (direction in ('payment', 'refund')),
  category    text not null check (category in ('tokens', 'game', 'drinks', 'other')),
  amount_eur  numeric(10,2) not null check (amount_eur >= 0),
  method      text,                                    -- card | cash | bank | online | ...
  account_id  uuid references public.accounts(id) on delete set null,
  match_id    uuid references public.matches(id) on delete set null,
  source      text not null default 'manual',          -- token_purchase | game_online | manual
  source_ref  text,
  note        text,
  created_by  uuid references public.accounts(id),
  created_at  timestamptz not null default now()
);
create index financial_entries_occurred_idx on public.financial_entries (occurred_at desc);
create index financial_entries_cat_idx on public.financial_entries (category, direction);

alter table public.financial_entries enable row level security;
drop policy if exists financial_entries_admin on public.financial_entries;
create policy financial_entries_admin on public.financial_entries for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.financial_entries to authenticated;
grant insert on public.financial_entries to service_role;

-- --- checkout intents (pre-payment; not a financial record) -----------------
create table public.checkout_intents (
  id                    uuid primary key default gen_random_uuid(),
  account_id            uuid not null references public.accounts(id) on delete cascade,
  kind                  text not null check (kind in ('bundle', 'gift')),
  bundle_id             uuid references public.token_bundles(id),
  tokens                numeric(12,4) not null,
  price_eur             numeric(10,2) not null,
  validity_months       integer not null,
  gift_recipient_account uuid references public.accounts(id),
  gift_recipient_email  text,
  gift_message          text,
  status                text not null default 'pending' check (status in ('pending', 'fulfilled')),
  created_at            timestamptz not null default now(),
  fulfilled_at          timestamptz
);
create index checkout_intents_account_idx on public.checkout_intents (account_id, created_at desc);

alter table public.checkout_intents enable row level security;
drop policy if exists checkout_intents_own on public.checkout_intents;
create policy checkout_intents_own on public.checkout_intents for select to authenticated
  using (account_id = public.current_account_id() or public.is_admin());
grant select on public.checkout_intents to authenticated;
grant select, insert, update on public.checkout_intents to service_role;

-- --- claimable gifts (recipient has no account yet) -------------------------
create table public.token_gifts (
  id               uuid primary key default gen_random_uuid(),
  buyer_account_id uuid references public.accounts(id) on delete set null,
  recipient_email  text not null,
  tokens           numeric(12,4) not null,
  validity_months  integer not null,
  message          text,
  claim_code       text not null unique,
  status           text not null default 'unclaimed' check (status in ('unclaimed', 'claimed')),
  claimed_by       uuid references public.accounts(id),
  created_at       timestamptz not null default now(),
  claimed_at       timestamptz
);
create index token_gifts_code_idx on public.token_gifts (claim_code);

alter table public.token_gifts enable row level security;
drop policy if exists token_gifts_own on public.token_gifts;
create policy token_gifts_own on public.token_gifts for select to authenticated
  using (buyer_account_id = public.current_account_id() or public.is_admin());
grant select on public.token_gifts to authenticated;
grant select, insert, update on public.token_gifts to service_role;

-- --- create a checkout intent (player initiates; returns id) ----------------
create or replace function public.create_checkout_intent(
  p_kind text, p_bundle_id uuid, p_gift_ops text, p_gift_email text, p_gift_message text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  acct uuid := public.current_account_id();
  cfg public.token_config; b public.token_bundles;
  toks numeric; price numeric; vm integer;
  rcpt_acct uuid; rcpt_email text; new_id uuid;
begin
  if acct is null then raise exception 'Sign in first.'; end if;
  if p_kind not in ('bundle', 'gift') then raise exception 'Unknown purchase.'; end if;
  select * into cfg from public.token_config where id = 1;

  if p_bundle_id is not null then
    select * into b from public.token_bundles where id = p_bundle_id and is_active;
    if b.id is null then raise exception 'That bundle is not available.'; end if;
    toks := b.tokens; price := b.price_eur;
    vm := coalesce(b.validity_months, cfg.default_validity_months, 6);
  else
    -- single game token (gift only)
    if p_kind <> 'gift' then raise exception 'Pick a bundle.'; end if;
    toks := 1; price := cfg.single_token_price_eur; vm := cfg.single_token_validity_months;
  end if;

  if p_kind = 'gift' then
    if coalesce(btrim(p_gift_ops), '') <> '' then
      select id into rcpt_acct from public.accounts where lower(ops_tag) = lower(btrim(p_gift_ops)) limit 1;
      if rcpt_acct is null then raise exception 'No player found with that ops tag.'; end if;
    elsif coalesce(btrim(p_gift_email), '') <> '' then
      rcpt_email := lower(btrim(p_gift_email));
      -- If the email already belongs to an account, deliver straight to it.
      select id into rcpt_acct from public.accounts where lower(email) = rcpt_email limit 1;
    else
      raise exception 'Add who the gift is for.';
    end if;
  end if;

  insert into public.checkout_intents (account_id, kind, bundle_id, tokens, price_eur, validity_months,
                                       gift_recipient_account, gift_recipient_email, gift_message)
    values (acct, p_kind, p_bundle_id, toks, price, vm, rcpt_acct, rcpt_email, nullif(btrim(p_gift_message), ''))
    returning id into new_id;
  return new_id;
end;
$$;
grant execute on function public.create_checkout_intent(text, uuid, text, text, text) to authenticated;

-- --- fulfil a paid intent (payment webhook; service role) -------------------
-- Idempotent. Writes the buyer's paid purchase + the financial ledger row, then
-- delivers tokens: bundle -> buyer; gift to an account -> that account; gift to
-- an email with no account -> a claimable token_gift. Returns a JSON descriptor
-- so the caller can send the right notification + emails.
create or replace function public.fulfill_checkout_intent(p_intent_id uuid, p_provider text, p_ref text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ci public.checkout_intents; pur_id uuid; code text; result jsonb;
begin
  select * into ci from public.checkout_intents where id = p_intent_id for update;
  if ci.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if ci.status = 'fulfilled' then return jsonb_build_object('ok', true, 'already', true); end if;

  -- Buyer's paid purchase record + money-in ledger row.
  insert into public.token_purchases (account_id, bundle_id, tokens, price_eur, validity_months, status, payment_provider, payment_ref, paid_at)
    values (ci.account_id, ci.bundle_id, ci.tokens, ci.price_eur, ci.validity_months, 'paid', p_provider, p_ref, now())
    returning id into pur_id;
  insert into public.financial_entries (direction, category, amount_eur, method, account_id, source, source_ref, note)
    values ('payment', 'tokens', ci.price_eur, 'online', ci.account_id, 'token_purchase', coalesce(p_ref, pur_id::text),
            case when ci.kind = 'gift' then 'Gift purchase' else 'Bundle purchase' end);

  if ci.kind = 'bundle' then
    perform public._grant_token_lot(ci.account_id, ci.tokens, 'purchase', ci.validity_months, pur_id, 'Bundle purchase', null, null);
    result := jsonb_build_object('ok', true, 'kind', 'bundle', 'buyer', ci.account_id, 'tokens', ci.tokens);
  elsif ci.gift_recipient_account is not null then
    perform public._grant_token_lot(ci.gift_recipient_account, ci.tokens, 'gift', ci.validity_months, pur_id, 'Gift received', ci.account_id, null);
    result := jsonb_build_object('ok', true, 'kind', 'gift_direct', 'buyer', ci.account_id,
                                 'recipient_account', ci.gift_recipient_account, 'tokens', ci.tokens, 'message', ci.gift_message);
  else
    code := replace(gen_random_uuid()::text, '-', '');
    insert into public.token_gifts (buyer_account_id, recipient_email, tokens, validity_months, message, claim_code)
      values (ci.account_id, ci.gift_recipient_email, ci.tokens, ci.validity_months, ci.gift_message, code);
    result := jsonb_build_object('ok', true, 'kind', 'gift_email', 'buyer', ci.account_id,
                                 'recipient_email', ci.gift_recipient_email, 'tokens', ci.tokens, 'claim_code', code, 'message', ci.gift_message);
  end if;

  update public.checkout_intents set status = 'fulfilled', fulfilled_at = now() where id = ci.id;
  return result;
end;
$$;
revoke execute on function public.fulfill_checkout_intent(uuid, text, text) from public, anon;
grant execute on function public.fulfill_checkout_intent(uuid, text, text) to service_role;

-- --- claim an email gift (recipient, once signed up) ------------------------
create or replace function public.claim_token_gift(p_code text)
returns numeric language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); g public.token_gifts;
begin
  if acct is null then raise exception 'Sign in to claim your gift.'; end if;
  select * into g from public.token_gifts where claim_code = btrim(p_code) for update;
  if g.id is null then raise exception 'That gift code is not valid.'; end if;
  if g.status = 'claimed' then raise exception 'This gift has already been claimed.'; end if;
  perform public._grant_token_lot(acct, g.tokens, 'gift', g.validity_months, null, 'Gift claimed', g.buyer_account_id, null);
  update public.token_gifts set status = 'claimed', claimed_by = acct, claimed_at = now() where id = g.id;
  return g.tokens;
end;
$$;
grant execute on function public.claim_token_gift(text) to authenticated;

-- --- admin manual financial entry (cash game payments, drinks, refunds) -----
create or replace function public.admin_add_financial_entry(
  p_occurred_at timestamptz, p_direction text, p_category text, p_amount numeric,
  p_method text, p_account_id uuid, p_match_id uuid, p_note text
) returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_direction not in ('payment', 'refund') then raise exception 'Direction must be payment or refund.'; end if;
  if p_category not in ('tokens', 'game', 'drinks', 'other') then raise exception 'Unknown category.'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'Amount must be zero or more.'; end if;
  insert into public.financial_entries (occurred_at, direction, category, amount_eur, method, account_id, match_id, source, note, created_by)
    values (coalesce(p_occurred_at, now()), p_direction, p_category, p_amount, nullif(btrim(p_method), ''), p_account_id, p_match_id,
            'manual', nullif(btrim(p_note), ''), public.current_account_id())
    returning id into new_id;
  return new_id;
end;
$$;
grant execute on function public.admin_add_financial_entry(timestamptz, text, text, numeric, text, uuid, uuid, text) to authenticated;

-- --- notification type: you have been gifted tokens ------------------------
insert into public.notification_types (key, label, description, priority, is_active, sends_email, sends_push, delay_hours, sort_order, email_subject, email_html)
values ('tokens_gifted', 'Game tokens gifted to you', 'Sent to a player when someone gifts them LaserOps game tokens.', 2, true, true, true, 0, 41,
  'You have been gifted LaserOps game tokens',
  $g$<!DOCTYPE html>
<html><head><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background:#000;font-family:Montserrat,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#000;padding:24px 12px;"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;background:#111;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;">
      <tr><td align="center" style="padding:32px 24px 20px;background:#000;"><img src="{{logoUrl}}" width="220" alt="LaserOps Malta" style="display:block;border:0;max-width:220px;height:auto;"></td></tr>
      <tr><td style="background:#111;border-top:1px solid #ffde00;border-bottom:1px solid #ffde00;padding:16px 24px;text-align:center;">
        <div style="font-size:18px;font-weight:800;letter-spacing:.5px;color:#ffde00;text-transform:uppercase;">A Gift For You</div></td></tr>
      <tr><td style="padding:32px 28px;color:#fff;">
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:800;color:#fff;">{{title}}</h1>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#d8d8d8;">{{body}}</p>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center">
          <a href="{{link}}" style="display:block;background:#ffde00;color:#000;text-decoration:none;font-size:15px;font-weight:800;padding:15px 22px;border-radius:10px;text-transform:uppercase;letter-spacing:.4px;">View Your Tokens</a>
        </td></tr></table>
      </td></tr>
      <tr><td style="padding:20px 28px 28px;background:#080808;text-align:center;">
        <p style="margin:0;font-size:12px;line-height:1.5;color:#777;">LaserOps &middot; Outdoor tactical laser tag in Malta</p></td></tr>
    </table>
  </td></tr></table>
</body></html>$g$)
on conflict (key) do nothing;

-- --- backfill the ledger from existing money movements ----------------------
-- Paid token purchases -> payment/tokens.
insert into public.financial_entries (occurred_at, direction, category, amount_eur, method, account_id, source, source_ref, note)
  select coalesce(paid_at, created_at), 'payment', 'tokens', price_eur, coalesce(payment_provider, 'online'), account_id,
         'token_purchase', coalesce(payment_ref, id::text), 'Backfill: bundle purchase'
  from public.token_purchases where status = 'paid';
-- Refunded token purchases -> refund/tokens.
insert into public.financial_entries (occurred_at, direction, category, amount_eur, method, account_id, source, source_ref, note)
  select coalesce(paid_at, created_at), 'refund', 'tokens', price_eur, coalesce(payment_provider, 'online'), account_id,
         'token_purchase', coalesce(payment_ref, id::text), 'Backfill: bundle refund'
  from public.token_purchases where status = 'refunded';
-- Paid game signups (card or cash marked by an admin, NOT token-covered) -> payment/game.
insert into public.financial_entries (occurred_at, direction, category, amount_eur, method, account_id, match_id, source, source_ref, note)
  select paid_at, 'payment', 'game', coalesce(paid_amount_eur, 0),
         case when payment_intent = 'on_day' then 'cash' else 'online' end,
         account_id, match_id,
         case when payment_intent = 'on_day' then 'manual' else 'game_online' end,
         coalesce(payment_ref, stripe_payment_intent), 'Backfill: game payment'
  from public.match_signups
  where paid_at is not null and coalesce(payment_intent, '') <> 'token';
-- Refunded game signups -> refund/game.
insert into public.financial_entries (occurred_at, direction, category, amount_eur, method, account_id, match_id, source, source_ref, note)
  select refunded_at, 'refund', 'game', coalesce(refunded_amount_eur, 0), coalesce(payment_provider, 'online'),
         account_id, match_id, 'game_online', coalesce(payment_ref, stripe_payment_intent), 'Backfill: game refund'
  from public.match_signups where refunded_at is not null;
