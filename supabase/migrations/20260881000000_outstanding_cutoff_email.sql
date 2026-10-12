-- =============================================================================
-- Payments-due polish:
--  * Exclude legacy games from the outstanding feed - anything on or before
--    LO-2026-33 predates pay-after-game and should not show as owing.
--  * Return the player's email so admins can settle + contact from the page.
-- =============================================================================
drop function if exists public.admin_outstanding_settlements();
create or replace function public.admin_outstanding_settlements()
returns table (
  match_id uuid, match_code text, title text, scheduled_at timestamptz,
  account_id uuid, ops_tag text, full_name text, email text,
  settled_declared_at timestamptz, player_marked_paid_at timestamptz,
  settlement_token_intent numeric, drinks_total_eur numeric, settlement_method text,
  game_fee numeric, owed numeric
) language sql stable security definer set search_path = public as $$
  select
    m.id, m.match_code, m.title, m.scheduled_at,
    p.account_id, a.ops_tag, a.full_name, a.email,
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
    -- Legacy cutoff: only pay-after-game era games (after LO-2026-33).
    and (
      (select coalesce(played_on, scheduled_at::date) from public.matches where match_code = 'LO-2026-33') is null
      or coalesce(m.played_on, m.scheduled_at::date)
         > (select coalesce(played_on, scheduled_at::date) from public.matches where match_code = 'LO-2026-33')
    )
  order by m.scheduled_at desc nulls last, a.ops_tag;
$$;
grant execute on function public.admin_outstanding_settlements() to authenticated;
