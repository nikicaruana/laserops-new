-- =============================================================================
-- Zero-rate auto-comp should NOT write a money ledger row. The auto-comp trigger
-- (20260850000000) marked a €0 place paid AND inserted a €0 'game_comp'
-- financial_entries row, which cluttered Last Transactions with "Payment · Game
-- €0.00" lines. A €0 comp is not a money event. Recreate the trigger function
-- WITHOUT the ledger insert; the place is still marked settled (paid_at + comp)
-- so it shows "Paid · free", needs no pay prompt, and is never owed a refund.
-- (Existing €0 game rows were deleted in 20260861000000.)
-- =============================================================================
create or replace function public.auto_comp_zero_rate_signup()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_mode text; v_price numeric; v_disc numeric; v_fee numeric;
begin
  -- Only a registered, not-yet-paid signup is a candidate.
  if new.status is distinct from 'registered' or new.paid_at is not null then
    return new;
  end if;

  select pricing_mode, price_eur into v_mode, v_price
    from public.matches where id = new.match_id;
  -- Only per-player-priced games carry an online fee to comp.
  if v_mode is distinct from 'per_player' or coalesce(v_price, 0) <= 0 then
    return new;
  end if;

  select discount_price_eur into v_disc
    from public.accounts where id = new.account_id;
  v_fee := coalesce(v_disc, v_price);
  if v_fee is null or v_fee > 0 then
    return new; -- they owe something: leave the normal pay flow in place
  end if;

  -- Free place: mark it settled (SECURITY DEFINER bypasses the player's column
  -- guard). Write NO ledger row - a €0 comp is not a money event. The place shows
  -- "Paid · free" from these columns; nothing is owed and nothing to refund.
  update public.match_signups
     set paid_at = now(),
         paid_amount_eur = 0,
         payment_intent = 'online',
         payment_provider = 'comp'
   where id = new.id and paid_at is null;

  return new;
end;
$$;
