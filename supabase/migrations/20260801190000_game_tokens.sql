-- =============================================================================
-- LaserOps Game Tokens (1 token = 1 free game). Bundles are bought in the store;
-- a confirmed payment grants a "lot" of tokens with an expiry. Tokens are spent
-- to pay for games (fractional allowed) and can be partially refunded as a
-- credit. SECURITY: players can only READ their own token rows - every mutation
-- goes through SECURITY DEFINER RPCs with strict authorization, so a player can
-- never grant/spoof tokens for themselves. The token_transactions ledger is
-- append-only (corrections are new offsetting rows) for a clean audit trail.
-- =============================================================================

-- --- config (admin-managed params) -----------------------------------------
create table public.token_config (
  id                      smallint primary key default 1 check (id = 1),
  default_validity_months integer not null default 6,
  updated_at              timestamptz not null default now()
);
insert into public.token_config (id) values (1) on conflict (id) do nothing;

-- --- store bundles ----------------------------------------------------------
create table public.token_bundles (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  tokens          numeric(12,4) not null check (tokens > 0),
  price_eur       numeric(10,2) not null check (price_eur >= 0),
  validity_months integer,               -- null = use config default
  is_active       boolean not null default true,
  sort_order      integer,
  created_at      timestamptz not null default now()
);
insert into public.token_bundles (name, tokens, price_eur, validity_months, sort_order)
  values ('5 Game Bundle', 5, 150, 6, 1);

-- --- purchases (financial record) ------------------------------------------
create table public.token_purchases (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references public.accounts(id) on delete cascade,
  bundle_id        uuid references public.token_bundles(id),
  tokens           numeric(12,4) not null,
  price_eur        numeric(10,2) not null,
  validity_months  integer not null,
  status           text not null default 'pending' check (status in ('pending','paid','refunded','cancelled')),
  payment_provider text,
  payment_ref      text,
  created_at       timestamptz not null default now(),
  paid_at          timestamptz
);
create index token_purchases_account_idx on public.token_purchases (account_id, created_at desc);

-- --- lots (grants; balance = sum of remaining, non-expired) -----------------
create table public.token_lots (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references public.accounts(id) on delete cascade,
  amount_granted   numeric(12,4) not null check (amount_granted > 0),
  amount_remaining numeric(12,4) not null check (amount_remaining >= 0),
  source           text not null check (source in ('purchase','milestone','refund','admin')),
  purchase_id      uuid references public.token_purchases(id),
  granted_at       timestamptz not null default now(),
  expires_at       timestamptz
);
create index token_lots_account_idx on public.token_lots (account_id, expires_at);

-- --- transactions (append-only ledger) -------------------------------------
create table public.token_transactions (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references public.accounts(id) on delete cascade,
  delta            numeric(12,4) not null,   -- + grant/refund, - spend/expiry
  kind             text not null check (kind in ('grant','spend','refund','expiry','adjustment')),
  lot_id           uuid references public.token_lots(id),
  match_id         uuid references public.matches(id) on delete set null,
  purchase_id      uuid references public.token_purchases(id),
  eur_amount       numeric(10,2),
  note             text,
  actor_account_id uuid references public.accounts(id),
  created_at       timestamptz not null default now()
);
create index token_tx_account_idx on public.token_transactions (account_id, created_at desc);
create index token_tx_created_idx on public.token_transactions (created_at desc);

-- --- RLS: players read their OWN rows (+ admins read all); NO client writes -
alter table public.token_config       enable row level security;
alter table public.token_bundles      enable row level security;
alter table public.token_purchases    enable row level security;
alter table public.token_lots         enable row level security;
alter table public.token_transactions enable row level security;

drop policy if exists token_config_read on public.token_config;
create policy token_config_read on public.token_config for select to anon, authenticated using (true);
drop policy if exists token_config_admin on public.token_config;
create policy token_config_admin on public.token_config for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.token_config to anon, authenticated;
-- UPDATE privilege for admins to edit config from the panel (RLS still gates to is_admin).
grant update on public.token_config to authenticated;

drop policy if exists token_bundles_read on public.token_bundles;
create policy token_bundles_read on public.token_bundles for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists token_bundles_admin on public.token_bundles;
create policy token_bundles_admin on public.token_bundles for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.token_bundles to anon, authenticated;
-- Write privileges for admins to manage bundles from the panel (RLS still gates to is_admin).
grant insert, update, delete on public.token_bundles to authenticated;

drop policy if exists token_purchases_read on public.token_purchases;
create policy token_purchases_read on public.token_purchases for select to authenticated using (account_id = public.current_account_id() or public.is_admin());
grant select on public.token_purchases to authenticated;

drop policy if exists token_lots_read on public.token_lots;
create policy token_lots_read on public.token_lots for select to authenticated using (account_id = public.current_account_id() or public.is_admin());
grant select on public.token_lots to authenticated;

drop policy if exists token_tx_read on public.token_transactions;
create policy token_tx_read on public.token_transactions for select to authenticated using (account_id = public.current_account_id() or public.is_admin());
grant select on public.token_transactions to authenticated;
-- No INSERT/UPDATE/DELETE grants to players on any token table: mutations are
-- ONLY via the SECURITY DEFINER RPCs below.
grant select, insert, update on public.token_purchases to service_role;
grant select, insert, update on public.token_lots to service_role;
grant insert on public.token_transactions to service_role;

-- --- balance ----------------------------------------------------------------
create or replace function public.token_balance(p_acct uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount_remaining), 0)::numeric(12,4)
  from public.token_lots
  where account_id = p_acct and amount_remaining > 0 and (expires_at is null or expires_at > now());
$$;
revoke execute on function public.token_balance(uuid) from public, anon;
grant execute on function public.token_balance(uuid) to service_role;

create or replace function public.my_token_balance()
returns numeric language sql stable security definer set search_path = public as $$
  select public.token_balance(public.current_account_id());
$$;
grant execute on function public.my_token_balance() to authenticated;

-- --- internal grant (creates a lot + ledger row). Server-only. -------------
create or replace function public._grant_token_lot(
  p_acct uuid, p_amount numeric, p_source text, p_validity_months integer,
  p_purchase_id uuid, p_note text, p_actor uuid, p_match_id uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare lot_id uuid; exp timestamptz;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'Grant amount must be positive.'; end if;
  if p_validity_months is not null and p_validity_months > 0 then
    exp := now() + make_interval(months => p_validity_months);
  end if;
  insert into public.token_lots (account_id, amount_granted, amount_remaining, source, purchase_id, expires_at)
    values (p_acct, p_amount, p_amount, p_source, p_purchase_id, exp)
    returning id into lot_id;
  insert into public.token_transactions (account_id, delta, kind, lot_id, match_id, purchase_id, note, actor_account_id)
    values (p_acct, p_amount, case when p_source = 'refund' then 'refund' else 'grant' end, lot_id, p_match_id, p_purchase_id, p_note, p_actor);
  return lot_id;
end;
$$;
revoke execute on function public._grant_token_lot(uuid, numeric, text, integer, uuid, text, uuid, uuid) from public, anon;
grant execute on function public._grant_token_lot(uuid, numeric, text, integer, uuid, text, uuid, uuid) to service_role;

-- --- create a purchase (player initiates; returns id for checkout) ---------
create or replace function public.create_token_purchase(p_bundle_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); b record; vm integer; new_id uuid;
begin
  if acct is null then raise exception 'Sign in to buy a bundle.'; end if;
  select * into b from public.token_bundles where id = p_bundle_id and is_active;
  if b.id is null then raise exception 'That bundle is not available.'; end if;
  vm := coalesce(b.validity_months, (select default_validity_months from public.token_config where id = 1), 6);
  insert into public.token_purchases (account_id, bundle_id, tokens, price_eur, validity_months, status)
    values (acct, b.id, b.tokens, b.price_eur, vm, 'pending')
    returning id into new_id;
  return new_id;
end;
$$;
grant execute on function public.create_token_purchase(uuid) to authenticated;

-- --- mark a purchase paid + grant its tokens (payment webhook; service role)
create or replace function public.mark_token_purchase_paid(p_purchase_id uuid, p_provider text, p_ref text)
returns boolean language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select * into p from public.token_purchases where id = p_purchase_id;
  if p.id is null then return false; end if;
  if p.status = 'paid' then return true; end if; -- idempotent
  update public.token_purchases set status = 'paid', paid_at = now(), payment_provider = p_provider, payment_ref = p_ref where id = p_purchase_id;
  perform public._grant_token_lot(p.account_id, p.tokens, 'purchase', p.validity_months, p.id, 'Bundle purchase', null, null);
  return true;
end;
$$;
revoke execute on function public.mark_token_purchase_paid(uuid, text, text) from public, anon;
grant execute on function public.mark_token_purchase_paid(uuid, text, text) to service_role;

-- --- admin manual grant (for goodwill / testing) ---------------------------
create or replace function public.admin_grant_tokens(p_acct uuid, p_amount numeric, p_validity_months integer, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  return public._grant_token_lot(p_acct, p_amount, 'admin', coalesce(p_validity_months, (select default_validity_months from public.token_config where id = 1), 6),
                                 null, coalesce(nullif(btrim(p_note), ''), 'Admin grant'), public.current_account_id(), null);
end;
$$;
grant execute on function public.admin_grant_tokens(uuid, numeric, integer, text) to authenticated;

-- --- admin refund tokens (partial credit, e.g. weather call-off) ------------
create or replace function public.admin_refund_tokens(p_acct uuid, p_amount numeric, p_match_id uuid, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  return public._grant_token_lot(p_acct, p_amount, 'refund', (select default_validity_months from public.token_config where id = 1),
                                 null, coalesce(nullif(btrim(p_note), ''), 'Token refund'), public.current_account_id(), p_match_id);
end;
$$;
grant execute on function public.admin_refund_tokens(uuid, numeric, uuid, text) to authenticated;

-- --- spend tokens on a game (player; own account only) ---------------------
-- Applies p_amount tokens (1 token = 1 full game) toward the caller's registered
-- signup. Draws down lots oldest-expiry-first. When the applied total reaches the
-- game's 1-token cost, the signup is marked paid. Fractional application is
-- allowed (part-payment); the remainder is paid online (charged for
-- 1 - tokens_applied of the price).
create or replace function public.spend_tokens(p_match_id uuid, p_amount numeric)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  acct uuid := public.current_account_id();
  m record; sg record; bal numeric; applied numeric; lot record; take numeric; todo numeric;
begin
  if acct is null then raise exception 'Sign in first.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive.'; end if;

  select id, status, price_eur, pricing_mode into m from public.matches where id = p_match_id;
  if m.id is null then raise exception 'Game not found.'; end if;
  if m.status not in ('confirmed', 'live') then raise exception 'This game is not open for payment.'; end if;

  select status, paid_at into sg from public.match_signups where match_id = p_match_id and account_id = acct;
  if sg.status is distinct from 'registered' then raise exception 'You are not signed up to this game.'; end if;
  if sg.paid_at is not null then raise exception 'This game is already paid.'; end if;

  -- tokens already applied by this player to this game (1 token = full game).
  select coalesce(-sum(delta), 0) into applied from public.token_transactions
    where account_id = acct and match_id = p_match_id and kind = 'spend';
  if applied + p_amount > 1 + 1e-6 then
    raise exception 'That is more than the game costs.';
  end if;

  select public.token_balance(acct) into bal;
  if bal < p_amount then raise exception 'Not enough tokens.'; end if;

  todo := p_amount;
  -- FOR UPDATE locks each lot so two concurrent spends can't over-draw the same
  -- lot (the amount_remaining >= 0 check is the final backstop).
  for lot in
    select * from public.token_lots
    where account_id = acct and amount_remaining > 0 and (expires_at is null or expires_at > now())
    order by expires_at asc nulls last, granted_at asc
    for update
  loop
    exit when todo <= 0;
    take := least(lot.amount_remaining, todo);
    update public.token_lots set amount_remaining = amount_remaining - take where id = lot.id;
    insert into public.token_transactions (account_id, delta, kind, lot_id, match_id)
      values (acct, -take, 'spend', lot.id, p_match_id);
    todo := todo - take;
  end loop;
  if todo > 1e-6 then raise exception 'Not enough tokens.'; end if;

  applied := applied + p_amount;
  -- Fully covered -> mark paid (record the euro value covered).
  if applied >= 1 - 1e-6 then
    update public.match_signups
      set paid_at = now(), payment_intent = 'token',
          paid_amount_eur = coalesce(m.price_eur, 0)
      where match_id = p_match_id and account_id = acct;
  end if;
  return applied;
end;
$$;
grant execute on function public.spend_tokens(uuid, numeric) to authenticated;

-- --- notification type for a completed bundle purchase ---------------------
insert into public.notification_types (key, label, description, priority, is_active, sends_email, sends_push, delay_hours, sort_order)
values ('tokens_granted', 'Game tokens added', 'Sent when a token bundle purchase completes and tokens are credited.', 2, true, false, true, 0, 40)
on conflict (key) do nothing;

-- --- expire lapsed lots (cron; service role) -------------------------------
create or replace function public.expire_tokens()
returns integer language plpgsql security definer set search_path = public as $$
declare lot record; n integer := 0;
begin
  for lot in select * from public.token_lots where amount_remaining > 0 and expires_at is not null and expires_at <= now() loop
    insert into public.token_transactions (account_id, delta, kind, lot_id, note)
      values (lot.account_id, -lot.amount_remaining, 'expiry', lot.id, 'Tokens expired');
    update public.token_lots set amount_remaining = 0 where id = lot.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.expire_tokens() from public, anon;
grant execute on function public.expire_tokens() to service_role;
