-- =============================================================================
-- Admin edit/delete of financial ledger entries (2FA-gated, like other money
-- actions). Used by the Financial reports edit mode.
-- =============================================================================
create or replace function public.admin_update_financial_entry(
  p_id uuid, p_direction text, p_category text, p_amount numeric, p_method text, p_note text, p_occurred_at timestamptz
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Two-factor authentication is required to edit financial entries.';
  end if;
  if p_direction is not null and p_direction not in ('payment', 'refund') then raise exception 'Invalid direction.'; end if;
  if p_category  is not null and p_category  not in ('game', 'drinks', 'tokens', 'other') then raise exception 'Invalid category.'; end if;
  if p_amount is not null and p_amount < 0 then raise exception 'Amount cannot be negative.'; end if;

  update public.financial_entries set
    direction   = coalesce(nullif(btrim(p_direction), ''), direction),
    category    = coalesce(nullif(btrim(p_category), ''), category),
    amount_eur  = coalesce(p_amount, amount_eur),
    method      = nullif(btrim(p_method), ''),
    note        = nullif(btrim(p_note), ''),
    occurred_at = coalesce(p_occurred_at, occurred_at)
  where id = p_id;
end;
$$;
grant execute on function public.admin_update_financial_entry(uuid, text, text, numeric, text, text, timestamptz) to authenticated;

create or replace function public.admin_delete_financial_entry(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Two-factor authentication is required to delete financial entries.';
  end if;
  delete from public.financial_entries where id = p_id;
end;
$$;
grant execute on function public.admin_delete_financial_entry(uuid) to authenticated;
