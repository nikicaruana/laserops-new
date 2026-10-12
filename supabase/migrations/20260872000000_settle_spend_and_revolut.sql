-- =============================================================================
-- Pay-after-game (Phase 1): settle_match_bill now ACTUALLY SPENDS the token when
-- the player applies it on the pay page (game already played -> no refund risk,
-- no admin approval needed for tokens). The Revolut/cash remainder is left for an
-- admin to confirm. Also adds the business Revolut link as admin config.
-- =============================================================================

-- Revolut pay link (admin-editable; read by the login-gated pay page).
alter table public.pricing_config add column if not exists revolut_pay_link text;
update public.pricing_config set revolut_pay_link = 'https://revolut.me/kylev23'
  where id = 1 and coalesce(revolut_pay_link, '') = '';

create or replace function public.admin_set_revolut_link(p_link text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.pricing_config set revolut_pay_link = nullif(btrim(p_link), ''), updated_at = now() where id = 1;
end;
$$;
grant execute on function public.admin_set_revolut_link(text) to authenticated;

-- Replace the declare-only RPC with one that spends the token immediately.
drop function if exists public.declare_match_settlement(uuid, numeric, text, jsonb);

create or replace function public.settle_match_bill(
  p_match_id uuid, p_token_amount numeric, p_method text, p_drinks jsonb, p_idempotency_key text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  acct uuid := public.current_account_id();
  m record; a_full text; a_ops text; a_disc numeric; game_fee numeric;
  want numeric; applied numeric; additional numeric; bal numeric;
  drinks_total numeric := 0; remaining numeric;
  d jsonb; dk record; drinks_note text := ''; token_note text := ''; full_note text; short_note text;
  lot record; take numeric; todo numeric;
begin
  if acct is null then raise exception 'Sign in first.'; end if;
  if coalesce(p_method, '') not in ('revolut', 'cash') then raise exception 'Choose Revolut or cash.'; end if;

  select id, status, price_eur, pricing_mode, match_code into m from public.matches where id = p_match_id;
  if m.id is null then raise exception 'Game not found.'; end if;
  if m.status not in ('live', 'completed') then raise exception 'This game is not ready for payment yet.'; end if;
  if coalesce(m.pricing_mode, '') <> 'per_player' then raise exception 'This booking is settled by the organiser.'; end if;
  if not exists (select 1 from public.match_participants where match_id = p_match_id and account_id = acct) then
    raise exception 'You are not on this game''s roster.';
  end if;

  select full_name, ops_tag, discount_price_eur into a_full, a_ops, a_disc from public.accounts where id = acct;
  game_fee := coalesce(a_disc, m.price_eur, 0);

  -- Token already applied to this game (1 token = 1 game); figure out the delta to spend now.
  select coalesce(-sum(delta), 0) into applied from public.token_transactions
    where account_id = acct and match_id = p_match_id and kind = 'spend';
  want := greatest(0, least(coalesce(p_token_amount, 0), 1));
  additional := round(greatest(0, want - applied), 4);

  if additional > 0 and p_idempotency_key is not null and length(p_idempotency_key) > 0 then
    insert into public.token_spend_attempts (idempotency_key, account_id, match_id, amount)
      values (p_idempotency_key, acct, p_match_id, additional) on conflict (idempotency_key) do nothing;
    if not found then additional := 0; end if; -- this exact spend already ran
  end if;

  if additional > 0 then
    select public.token_balance(acct) into bal;
    if bal < additional - 1e-6 then raise exception 'You do not have enough tokens.'; end if;
    todo := additional;
    for lot in
      select * from public.token_lots
      where account_id = acct and amount_remaining > 0 and (expires_at is null or expires_at > now())
      order by expires_at asc nulls last, granted_at asc for update
    loop
      exit when todo <= 0;
      take := least(lot.amount_remaining, todo);
      update public.token_lots set amount_remaining = amount_remaining - take where id = lot.id;
      insert into public.token_transactions (account_id, delta, kind, lot_id, match_id)
        values (acct, -take, 'spend', lot.id, p_match_id);
      todo := todo - take;
    end loop;
    if todo > 1e-6 then raise exception 'You do not have enough tokens.'; end if;
    applied := applied + additional;
  end if;

  -- Drinks: replace this player's selection for the match.
  delete from public.match_drink_orders where match_id = p_match_id and account_id = acct;
  if p_drinks is not null then
    for d in select * from jsonb_array_elements(p_drinks) loop
      select id, name, price_eur into dk from public.drink_menu where id = (d->>'drink_id')::uuid and is_active;
      if dk.id is not null and coalesce((d->>'qty')::int, 0) > 0 then
        insert into public.match_drink_orders (match_id, account_id, drink_id, name, unit_price_eur, qty)
          values (p_match_id, acct, dk.id, dk.name, dk.price_eur, (d->>'qty')::int);
        drinks_total := drinks_total + dk.price_eur * (d->>'qty')::int;
        drinks_note := drinks_note || ' - ' || (d->>'qty')::int || 'x ' || dk.name;
      end if;
    end loop;
  end if;

  remaining := round(game_fee * (1 - applied) + drinks_total, 2);
  if applied > 0 then token_note := ' - Token ' || trim(to_char(applied, 'FM990.####')) || ' applied'; end if;
  short_note := coalesce(m.match_code, 'Game') || ' - ' || coalesce(a_ops, 'player');
  full_note := coalesce(a_full, a_ops, 'Player') || ' (' || coalesce(a_ops, '') || ') - ' || coalesce(m.match_code, 'game')
             || ' - Game EUR ' || trim(to_char(game_fee, 'FM990.00')) || token_note || drinks_note
             || ' - Pay EUR ' || trim(to_char(remaining, 'FM990.00')) || ' by ' || p_method;

  update public.match_participants
    set settlement_token_intent = applied, drinks_total_eur = drinks_total,
        settlement_method = p_method, settlement_note = full_note, settled_declared_at = now(),
        payment_intent = case when remaining <= 0.001 then 'token' else payment_intent end,
        paid_at = case when remaining <= 0.001 then now() else paid_at end,
        paid_amount_eur = case when remaining <= 0.001 then 0 else paid_amount_eur end
    where match_id = p_match_id and account_id = acct;

  return jsonb_build_object(
    'gameFee', game_fee, 'tokenApplied', applied, 'drinksTotal', drinks_total,
    'remaining', remaining, 'fullyCovered', (remaining <= 0.001), 'shortNote', short_note, 'fullNote', full_note
  );
end;
$$;
grant execute on function public.settle_match_bill(uuid, numeric, text, jsonb, text) to authenticated;
