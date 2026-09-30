-- Admin can (re)price a single game after creation: set the pricing mode
-- (per-player online vs flat offline), the price, and an optional deposit.
-- Needed for player-requested private bookings, which arrive as flat + unpriced
-- for the admin to price at confirm time. is_admin gated (the UI wraps it in the
-- 2FA TotpGate, like admin_set_pricing_config).
create or replace function public.admin_set_match_pricing(
  p_match_id uuid, p_price numeric, p_pricing_mode text, p_deposit numeric
) returns void language plpgsql security definer set search_path = public as $$
declare m record;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_pricing_mode not in ('per_player', 'flat') then raise exception 'Invalid pricing mode.'; end if;
  if p_price is not null and p_price < 0 then raise exception 'Price must be 0 or more.'; end if;
  if p_deposit is not null and p_deposit < 0 then raise exception 'Deposit must be 0 or more.'; end if;

  select id, status into m from public.matches where id = p_match_id;
  if m.id is null then raise exception 'Game not found.'; end if;
  if m.status in ('completed', 'cancelled') then raise exception 'This game can no longer be re-priced.'; end if;
  if p_pricing_mode = 'per_player' and (p_price is null or p_price <= 0) then
    raise exception 'Per-player pricing needs a price above 0.';
  end if;

  update public.matches
     set price_eur = p_price, pricing_mode = p_pricing_mode, deposit_eur = p_deposit, updated_at = now()
   where id = p_match_id;
end;
$$;

grant execute on function public.admin_set_match_pricing(uuid, numeric, text, numeric) to authenticated;
