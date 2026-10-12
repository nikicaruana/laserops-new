-- Pay-after-game fix: match_participants needs paid_amount_eur (the cash/Revolut
-- collected on settlement). settle_match_bill + admin_confirm_settlement write it.
alter table public.match_participants add column if not exists paid_amount_eur numeric(10,2);
