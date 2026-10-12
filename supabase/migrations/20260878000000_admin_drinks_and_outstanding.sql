-- =============================================================================
-- Pay-after-game (Phase 1 polish):
--  1. admin_set_participant_drinks - let an admin record/adjust a player's drinks
--     for a game (walk-ins who don't self-report on the pay page). Replaces that
--     player's drink lines, recomputes drinks_total_eur. Does NOT touch tokens or
--     paid state; the admin then "Mark paid" to confirm (which bills the drinks).
--  2. admin_outstanding_settlements - a cross-game "who still owes" feed: every
--     per-player, already-played game roster line that is linked to an account and
--     not yet marked paid, with the amount owed (game fee less token, plus drinks).
-- =============================================================================

-- 1) Admin sets a participant's drinks (snapshot name+price from the menu).
create or replace function public.admin_set_participant_drinks(
  p_match_id uuid, p_account_id uuid, p_drinks jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d jsonb; dk record; drinks_total numeric := 0;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if not exists (select 1 from public.match_participants where match_id = p_match_id and account_id = p_account_id) then
    raise exception 'Player is not on this game.';
  end if;

  delete from public.match_drink_orders where match_id = p_match_id and account_id = p_account_id;
  if p_drinks is not null then
    for d in select * from jsonb_array_elements(p_drinks) loop
      select id, name, price_eur into dk from public.drink_menu where id = (d->>'drink_id')::uuid and is_active;
      if dk.id is not null and coalesce((d->>'qty')::int, 0) > 0 then
        insert into public.match_drink_orders (match_id, account_id, drink_id, name, unit_price_eur, qty)
          values (p_match_id, p_account_id, dk.id, dk.name, dk.price_eur, (d->>'qty')::int);
        drinks_total := drinks_total + dk.price_eur * (d->>'qty')::int;
      end if;
    end loop;
  end if;

  -- Reflect on the roster line so Mark paid bills it; surface the line as declared.
  update public.match_participants
     set drinks_total_eur = drinks_total,
         settled_declared_at = coalesce(settled_declared_at, now())
   where match_id = p_match_id and account_id = p_account_id;

  return jsonb_build_object('drinksTotal', drinks_total);
end;
$$;
grant execute on function public.admin_set_participant_drinks(uuid, uuid, jsonb) to authenticated;

-- 2) Cross-game outstanding settlements (who still owes).
create or replace function public.admin_outstanding_settlements()
returns table (
  match_id uuid, match_code text, title text, scheduled_at timestamptz,
  account_id uuid, ops_tag text, full_name text,
  settled_declared_at timestamptz, player_marked_paid_at timestamptz,
  settlement_token_intent numeric, drinks_total_eur numeric, settlement_method text,
  game_fee numeric, owed numeric
) language sql stable security definer set search_path = public as $$
  select
    m.id, m.match_code, m.title, m.scheduled_at,
    p.account_id, a.ops_tag, a.full_name,
    p.settled_declared_at, p.player_marked_paid_at,
    coalesce(p.settlement_token_intent, 0), coalesce(p.drinks_total_eur, 0), p.settlement_method,
    coalesce(a.discount_price_eur, m.price_eur, 0) as game_fee,
    round(coalesce(a.discount_price_eur, m.price_eur, 0) * (1 - coalesce(p.settlement_token_intent, 0))
          + coalesce(p.drinks_total_eur, 0), 2) as owed
  from public.match_participants p
  join public.matches m on m.id = p.match_id
  join public.accounts a on a.id = p.account_id
  where public.is_admin()
    and coalesce(m.pricing_mode, '') = 'per_player'
    and m.status in ('live', 'completed')
    and p.account_id is not null
    and p.paid_at is null
  order by m.scheduled_at desc nulls last, a.ops_tag;
$$;
grant execute on function public.admin_outstanding_settlements() to authenticated;
