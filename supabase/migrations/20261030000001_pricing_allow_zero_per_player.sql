-- Allow a deliberate per-player price of 0.
-- Since drinks-settlement exists, "per player, EUR 0" is a legitimate config: an
-- organiser-paid game where no game fee is charged but players still settle their
-- own drinks/extras online (the pay page computes the game fee as 0 and bills only
-- drinks). The old guard rejected 0 outright (pre-dating drinks settlement). We
-- still require a non-null price so an admin can't save a per-player game with no
-- price decision at all; negatives are already rejected above.
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
  if p_pricing_mode = 'per_player' and p_price is null then
    raise exception 'Per-player pricing needs a price (use 0 for an organiser-paid game where players only settle drinks/extras).';
  end if;

  update public.matches
     set price_eur = p_price, pricing_mode = p_pricing_mode, deposit_eur = p_deposit, updated_at = now()
   where id = p_match_id;
end;
$$;

grant execute on function public.admin_set_match_pricing(uuid, numeric, text, numeric) to authenticated;
