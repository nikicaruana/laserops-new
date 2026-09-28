-- =============================================================================
-- Per-account "family & friends" discount (2026-09-28).
-- =============================================================================
-- A permanent percentage discount on an account's per-player game fee. 0 = none
-- (the default), 100 = free. Applied to the CASH they pay for a game (after any
-- tokens). Set by admins via admin_set_player_discount; the player can read their
-- own value (accounts_select_own) so the game pages can show the reduced price.
-- =============================================================================
alter table public.accounts
  add column if not exists discount_pct integer not null default 0
    check (discount_pct >= 0 and discount_pct <= 100);

-- Admin-only setter (SECURITY DEFINER; the admin's own accounts_admin_write RLS
-- would also allow it, but this validates the range + is a clean single entry).
create or replace function public.admin_set_player_discount(p_acct uuid, p_pct integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_pct is null or p_pct < 0 or p_pct > 100 then raise exception 'Discount must be between 0 and 100.'; end if;
  update public.accounts set discount_pct = p_pct where id = p_acct;
end;
$$;

grant execute on function public.admin_set_player_discount(uuid, integer) to authenticated;
