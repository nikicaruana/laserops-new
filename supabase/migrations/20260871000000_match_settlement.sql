-- =============================================================================
-- Pay-after-game epic (Phase 1, additive/dormant): per-player post-game bill.
-- A player settles on the pay page: pick a token amount (0..1, fractional), pick
-- drinks (with qty), see the amount to pay by Revolut (or choose cash). This only
-- DECLARES the settlement + computes the total + builds notes; the token is
-- actually spent, the player marked paid and financial entries written only when
-- an admin CONFIRMS in the Match Manager (Phase 1 part 3). Nothing on live uses
-- this yet.
-- =============================================================================

-- Itemised drinks a player added to their bill for a match (snapshots name+price).
create table if not exists public.match_drink_orders (
  id             uuid primary key default gen_random_uuid(),
  match_id       uuid not null references public.matches(id) on delete cascade,
  account_id     uuid not null references public.accounts(id) on delete cascade,
  drink_id       uuid references public.drink_menu(id) on delete set null,
  name           text not null,
  unit_price_eur numeric(10,2) not null,
  qty            integer not null check (qty > 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (match_id, account_id, drink_id)
);
alter table public.match_drink_orders enable row level security;
drop policy if exists match_drink_orders_own on public.match_drink_orders;
create policy match_drink_orders_own on public.match_drink_orders
  for select to authenticated using (account_id = public.current_account_id() or public.is_admin());
drop policy if exists match_drink_orders_admin on public.match_drink_orders;
create policy match_drink_orders_admin on public.match_drink_orders
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.match_drink_orders to authenticated;
grant select, insert, update, delete on public.match_drink_orders to service_role;

-- Settlement fields on the played-roster row (match_participants already has
-- paid_at + payment_intent). These capture the player's declared intent + memo.
alter table public.match_participants
  add column if not exists settlement_token_intent numeric(10,4) not null default 0,
  add column if not exists drinks_total_eur         numeric(10,2) not null default 0,
  add column if not exists settlement_method        text,
  add column if not exists settlement_note          text,
  add column if not exists settled_declared_at      timestamptz;

-- Player declares their settlement for a game they played. Records drinks + token
-- intent + a short/full note; returns the computed amounts. No token is spent and
-- no payment is marked here - the admin confirms later.
create or replace function public.declare_match_settlement(
  p_match_id uuid, p_token_amount numeric, p_method text, p_drinks jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  acct uuid := public.current_account_id();
  m record; a_full text; a_ops text; a_disc numeric; game_fee numeric;
  tok numeric; bal numeric; drinks_total numeric := 0; remaining numeric;
  d jsonb; dk record; drinks_note text := ''; full_note text; short_note text; token_note text := '';
begin
  if acct is null then raise exception 'Sign in first.'; end if;
  if coalesce(p_method,'') not in ('revolut','cash') then raise exception 'Choose Revolut or cash.'; end if;

  select id, status, price_eur, pricing_mode, match_code into m from public.matches where id = p_match_id;
  if m.id is null then raise exception 'Game not found.'; end if;
  if m.status not in ('live','completed') then raise exception 'This game is not ready for payment yet.'; end if;
  if coalesce(m.pricing_mode,'') <> 'per_player' then raise exception 'This booking is settled by the organiser.'; end if;

  if not exists (select 1 from public.match_participants where match_id = p_match_id and account_id = acct) then
    raise exception 'You are not on this game''s roster.';
  end if;

  select full_name, ops_tag, discount_price_eur into a_full, a_ops, a_disc from public.accounts where id = acct;
  game_fee := coalesce(a_disc, m.price_eur, 0);

  -- Token (fraction of one game). Validate availability now; spent on admin confirm.
  tok := greatest(0, least(coalesce(p_token_amount, 0), 1));
  if tok > 0 then
    select public.token_balance(acct) into bal;
    if tok > bal + 1e-6 then raise exception 'You do not have that many tokens.'; end if;
    token_note := ' - Token ' || trim(to_char(tok, 'FM990.####')) || ' applied';
  end if;

  -- Replace the player's drink order for this match with the new selection.
  delete from public.match_drink_orders where match_id = p_match_id and account_id = acct;
  if p_drinks is not null then
    for d in select * from jsonb_array_elements(p_drinks) loop
      select id, name, price_eur into dk from public.drink_menu
        where id = (d->>'drink_id')::uuid and is_active;
      if dk.id is not null and coalesce((d->>'qty')::int, 0) > 0 then
        insert into public.match_drink_orders (match_id, account_id, drink_id, name, unit_price_eur, qty)
          values (p_match_id, acct, dk.id, dk.name, dk.price_eur, (d->>'qty')::int);
        drinks_total := drinks_total + dk.price_eur * (d->>'qty')::int;
        drinks_note := drinks_note || ' - ' || (d->>'qty')::int || 'x ' || dk.name;
      end if;
    end loop;
  end if;

  remaining := round(game_fee * (1 - tok) + drinks_total, 2);
  short_note := coalesce(m.match_code, 'Game') || ' - ' || coalesce(a_ops, 'player');
  full_note := coalesce(a_full, a_ops, 'Player') || ' (' || coalesce(a_ops,'') || ') - ' || coalesce(m.match_code,'game')
               || ' - Game EUR ' || trim(to_char(game_fee,'FM990.00')) || token_note || drinks_note
               || ' - Pay EUR ' || trim(to_char(remaining,'FM990.00')) || ' by ' || p_method;

  update public.match_participants
    set settlement_token_intent = tok, drinks_total_eur = drinks_total,
        settlement_method = p_method, settlement_note = full_note, settled_declared_at = now()
    where match_id = p_match_id and account_id = acct;

  return jsonb_build_object(
    'gameFee', game_fee, 'tokenIntent', tok, 'drinksTotal', drinks_total,
    'remaining', remaining, 'shortNote', short_note, 'fullNote', full_note
  );
end;
$$;
grant execute on function public.declare_match_settlement(uuid, numeric, text, jsonb) to authenticated;
