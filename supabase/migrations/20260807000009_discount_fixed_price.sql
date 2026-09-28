-- =============================================================================
-- Family & friends discount: switch from a percentage to a HARD-CODED price
-- (2026-09-28). discount_price_eur = the flat per-player game fee this player
-- pays (null = no discount, normal price). Replaces the discount_pct column.
-- =============================================================================
alter table public.accounts
  add column if not exists discount_price_eur numeric(10,2)
    check (discount_price_eur is null or discount_price_eur >= 0);

alter table public.accounts drop column if exists discount_pct;
drop function if exists public.admin_set_player_discount(uuid, integer);

-- Set (or clear, with null) a player's fixed family & friends price.
create or replace function public.admin_set_player_price(p_acct uuid, p_price numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_price is not null and p_price < 0 then raise exception 'Price must be 0 or more.'; end if;
  update public.accounts set discount_price_eur = p_price where id = p_acct;
end;
$$;

grant execute on function public.admin_set_player_price(uuid, numeric) to authenticated;
