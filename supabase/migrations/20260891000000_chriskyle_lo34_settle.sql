-- =============================================================================
-- One-off: settle ChrisKyle for LO-2026-34 at EUR 20 (Revolut) instead of his
-- EUR 25 family & friends rate. He was unsettled. Idempotent: only acts if the
-- participant row is still unpaid.
-- =============================================================================
do $$
declare mid uuid; aid uuid;
begin
  select id into mid from public.matches  where match_code = 'LO-2026-34';
  select id into aid from public.accounts where ops_tag = 'ChrisKyle';
  if mid is null or aid is null then return; end if;

  update public.match_participants
     set paid_at = now(), payment_intent = 'revolut', paid_amount_eur = 20, settlement_method = 'revolut'
   where match_id = mid and account_id = aid and paid_at is null;

  if found then
    insert into public.financial_entries (direction, category, amount_eur, method, account_id, match_id, source, note)
      values ('payment', 'game', 20, 'revolut', aid, mid, 'game_manual',
              'Game fee (revolut, custom EUR 20 one-off - EUR 25 rate corrected to EUR 20 for this game)');
  end if;
end $$;
