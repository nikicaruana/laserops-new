-- =============================================================================
-- Financial entries: separate GAME DATE from PAYMENT DATE.
--
-- occurred_at has always been the moment the money was recorded (the payment /
-- resolution time). For game-related revenue that's often days after the game
-- was actually played - and the revenue really belongs to the day of the game,
-- not the day it was settled. So we add game_date: for a game/drinks entry tied
-- to a match, the date the game was PLAYED. Reporting aggregates game revenue by
-- game_date; token purchases and other entries keep reporting on occurred_at
-- (their game_date stays null).
--
-- Also: default the settlement method to Revolut (was cash) when none is given.
-- =============================================================================

alter table public.financial_entries add column if not exists game_date date;
comment on column public.financial_entries.game_date is
  'For game-related revenue (category game/drinks tied to a match), the date the game was PLAYED - when the revenue was generated. Null for token purchases and other entries, which report on their payment date (occurred_at). Auto-set by trg_financial_entry_game_date.';
create index if not exists financial_entries_game_date_idx on public.financial_entries (game_date);

-- Auto-fill game_date from the linked match on insert (covers every write path:
-- the settlement RPC, online game payments/refunds, and manual admin entries).
-- Uses the game's actual played date, falling back to its scheduled day (Malta).
create or replace function public.set_financial_entry_game_date()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.game_date is null and new.match_id is not null and new.category in ('game', 'drinks') then
    select coalesce(m.played_on, (m.scheduled_at at time zone 'Europe/Malta')::date)
      into new.game_date
      from public.matches m where m.id = new.match_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_financial_entry_game_date on public.financial_entries;
create trigger trg_financial_entry_game_date
  before insert on public.financial_entries
  for each row execute function public.set_financial_entry_game_date();

-- Backfill existing game/drinks entries from their match.
update public.financial_entries fe
   set game_date = coalesce(m.played_on, (m.scheduled_at at time zone 'Europe/Malta')::date)
  from public.matches m
 where fe.match_id = m.id
   and fe.category in ('game', 'drinks')
   and fe.game_date is null;

-- --- admin_confirm_settlement: default method = Revolut (was cash) -----------
-- Unchanged otherwise; re-declared so the method fallback is 'revolut'. game_date
-- on its two inserts is handled by the trigger above.
create or replace function public.admin_confirm_settlement(
  p_match_id uuid, p_account_id uuid, p_method text default null,
  p_amount_override numeric default null, p_drinks_override numeric default null
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

  -- An inline drinks amount replaces any itemised order for this player.
  if p_drinks_override is not null then
    delete from public.match_drink_orders where match_id = p_match_id and account_id = p_account_id;
    drinks_total := round(greatest(p_drinks_override, 0), 2);
    update public.match_participants set drinks_total_eur = drinks_total where id = p.id;
  else
    drinks_total := coalesce(p.drinks_total_eur, 0);
  end if;

  select discount_price_eur into a_disc from public.accounts where id = p_account_id;
  game_fee := coalesce(a_disc, (select price_eur from public.matches where id = p_match_id), 0);
  token_applied := coalesce(p.settlement_token_intent, 0);
  game_cash := round(coalesce(p_amount_override, game_fee * (1 - token_applied)), 2);
  if game_cash < 0 then game_cash := 0; end if;
  method := coalesce(nullif(btrim(p_method), ''), p.settlement_method, 'revolut');
  if method not in ('cash', 'revolut') then method := 'revolut'; end if;

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
grant execute on function public.admin_confirm_settlement(uuid, uuid, text, numeric, numeric) to authenticated;
