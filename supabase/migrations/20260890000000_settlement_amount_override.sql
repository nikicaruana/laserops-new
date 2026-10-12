-- =============================================================================
-- Settlement: allow an optional custom game-fee amount when an admin marks a
-- player paid (one-off rate corrections, e.g. a special price for one game).
-- When p_amount_override is given it replaces the computed game cash
-- (price/discount less any token); drinks are still added on top.
-- =============================================================================
drop function if exists public.admin_confirm_settlement(uuid, uuid, text);

create or replace function public.admin_confirm_settlement(
  p_match_id uuid, p_account_id uuid, p_method text default null, p_amount_override numeric default null
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
  game_cash := round(coalesce(p_amount_override, game_fee * (1 - token_applied)), 2);
  if game_cash < 0 then game_cash := 0; end if;
  method := coalesce(nullif(btrim(p_method), ''), p.settlement_method, 'cash');
  if method not in ('cash', 'revolut') then method := 'cash'; end if;

  update public.match_participants
     set paid_at = now(), payment_intent = method, paid_amount_eur = round(game_cash + drinks_total, 2),
         settlement_method = method
   where id = p.id;

  if game_cash > 0 then
    insert into public.financial_entries (direction, category, amount_eur, method, account_id, match_id, source, note)
      values ('payment', 'game', game_cash, method, p_account_id, p_match_id, 'game_manual',
              'Game fee (' || method
              || (case when token_applied > 0 then ', token ' || trim(to_char(token_applied, 'FM990.####')) || ' applied' else '' end)
              || (case when p_amount_override is not null then ', custom amount' else '' end) || ')');
  end if;
  if drinks_total > 0 then
    insert into public.financial_entries (direction, category, amount_eur, method, account_id, match_id, source, note)
      values ('payment', 'drinks', drinks_total, method, p_account_id, p_match_id, 'drinks', 'Drinks (' || method || ')');
  end if;

  return jsonb_build_object('gameCash', game_cash, 'drinksTotal', drinks_total,
    'total', round(game_cash + drinks_total, 2), 'method', method, 'tokenApplied', token_applied);
end;
$$;
grant execute on function public.admin_confirm_settlement(uuid, uuid, text, numeric) to authenticated;
