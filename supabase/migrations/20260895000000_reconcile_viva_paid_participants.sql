-- =============================================================================
-- Reconcile legacy online (Viva) payments with the pay-after settlement model.
-- Pre-launch games (e.g. LO-2026-34) were paid at sign-up via Viva, which marked
-- match_signups.paid_at (and wrote the financial_entries row at the time). The
-- new Payments due page + Match Manager read match_participants.paid_at, so those
-- players still showed as owing. Backfill the roster from the paid signup (NO new
-- financial entry - the money was already recorded), and make the outstanding feed
-- also skip anyone whose signup is paid.
-- =============================================================================

update public.match_participants p
   set paid_at           = s.paid_at,
       paid_amount_eur   = coalesce(s.paid_amount_eur, p.paid_amount_eur),
       settlement_method = case when s.payment_provider is not null then 'card' else coalesce(p.settlement_method, 'card') end,
       payment_intent    = 'online'
  from public.match_signups s
 where s.match_id = p.match_id
   and s.account_id = p.account_id
   and s.paid_at is not null
   and p.paid_at is null;

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
    -- Skip anyone who already paid at sign-up (legacy Viva / online).
    and not exists (
      select 1 from public.match_signups ms
      where ms.match_id = m.id and ms.account_id = p.account_id and ms.paid_at is not null
    )
    -- Legacy cutoff: only pay-after-game era games (after LO-2026-33).
    and (
      (select coalesce(played_on, scheduled_at::date) from public.matches where match_code = 'LO-2026-33') is null
      or coalesce(m.played_on, m.scheduled_at::date)
         > (select coalesce(played_on, scheduled_at::date) from public.matches where match_code = 'LO-2026-33')
    )
  order by m.scheduled_at desc nulls last, a.ops_tag;
$$;
grant execute on function public.admin_outstanding_settlements() to authenticated;
