-- =============================================================================
-- Pay-after-game (Phase 1, part 3): admin confirms a player's post-game payment.
-- The token (if any) was already spent on the pay page; confirming records the
-- cash/Revolut money as financial_entries (game fee + drinks, by method) and
-- marks the player paid. Also an un-confirm to reverse a mistake.
-- =============================================================================
create or replace function public.admin_confirm_settlement(
  p_match_id uuid, p_account_id uuid, p_method text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p record; a_disc numeric; game_fee numeric; token_applied numeric; drinks_total numeric;
  game_cash numeric; method text;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;

  select id, paid_at, settlement_token_intent, drinks_total_eur, settlement_method
    into p from public.match_participants where match_id = p_match_id and account_id = p_account_id;
  if p.id is null then raise exception 'Player is not on this game.'; end if;
  if p.paid_at is not null then return jsonb_build_object('alreadyPaid', true); end if;

  select discount_price_eur into a_disc from public.accounts where id = p_account_id;
  game_fee := coalesce(a_disc, (select price_eur from public.matches where id = p_match_id), 0);
  token_applied := coalesce(p.settlement_token_intent, 0);
  drinks_total  := coalesce(p.drinks_total_eur, 0);
  game_cash := round(game_fee * (1 - token_applied), 2);
  method := coalesce(nullif(btrim(p_method), ''), p.settlement_method, 'cash');
  if method not in ('cash', 'revolut') then method := 'cash'; end if;

  update public.match_participants
     set paid_at = now(), payment_intent = method, paid_amount_eur = round(game_cash + drinks_total, 2),
         settlement_method = method
   where id = p.id;

  -- Ledger: game fee cash (if any; token-covered portion is not cash) + drinks.
  if game_cash > 0 then
    insert into public.financial_entries (direction, category, amount_eur, method, account_id, match_id, source, note)
      values ('payment', 'game', game_cash, method, p_account_id, p_match_id, 'game_manual',
              'Game fee (' || method || (case when token_applied > 0 then ', token ' || trim(to_char(token_applied,'FM990.####')) || ' applied' else '' end) || ')');
  end if;
  if drinks_total > 0 then
    insert into public.financial_entries (direction, category, amount_eur, method, account_id, match_id, source, note)
      values ('payment', 'drinks', drinks_total, method, p_account_id, p_match_id, 'drinks', 'Drinks (' || method || ')');
  end if;

  return jsonb_build_object('gameCash', game_cash, 'drinksTotal', drinks_total,
    'total', round(game_cash + drinks_total, 2), 'method', method, 'tokenApplied', token_applied);
end;
$$;
grant execute on function public.admin_confirm_settlement(uuid, uuid, text) to authenticated;

-- Reverse a confirmation (clears paid + removes the manual money entries). The
-- token spend is NOT reversed here (that would be a token refund - do separately).
create or replace function public.admin_unconfirm_settlement(p_match_id uuid, p_account_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  delete from public.financial_entries
    where match_id = p_match_id and account_id = p_account_id and source in ('game_manual', 'drinks');
  update public.match_participants
     set paid_at = null, paid_amount_eur = null
   where match_id = p_match_id and account_id = p_account_id;
end;
$$;
grant execute on function public.admin_unconfirm_settlement(uuid, uuid) to authenticated;
