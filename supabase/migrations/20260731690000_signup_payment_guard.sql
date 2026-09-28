-- =============================================================================
-- Protect payment truth on match_signups. A player owns their signup row (RLS
-- update-own) so they can change status / payment_intent / booked_gun — but they
-- must NOT be able to set paid_at (that would be paying for free). A BEFORE
-- UPDATE trigger rejects any change to paid_at / paid_amount_eur made directly
-- by a player (role authenticated/anon). Those columns are written only by:
--   * the Stripe webhook — service_role (bypasses this check), and
--   * admin_set_signup_paid — SECURITY DEFINER, runs as the owner role.
-- =============================================================================

create or replace function public.guard_signup_paid()
returns trigger language plpgsql as $$
begin
  if (new.paid_at is distinct from old.paid_at
      or new.paid_amount_eur is distinct from old.paid_amount_eur)
     and current_user in ('authenticated', 'anon') then
    raise exception 'Payment status can only be set by payment processing.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_signup_paid on public.match_signups;
create trigger trg_guard_signup_paid before update on public.match_signups
  for each row execute function public.guard_signup_paid();

-- Admin reconciliation: mark a player's signup paid or unpaid (e.g. they paid in
-- cash on the day, or a refund). Definer so it can write the guarded columns.
create or replace function public.admin_set_signup_paid(
  p_match_id uuid, p_account_id uuid, p_paid boolean, p_amount numeric default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.match_signups
    set paid_at         = case when p_paid then coalesce(paid_at, now()) else null end,
        paid_amount_eur = case when p_paid then coalesce(p_amount, paid_amount_eur) else null end,
        payment_intent  = case when p_paid and payment_intent is null then 'online' else payment_intent end
    where match_id = p_match_id and account_id = p_account_id;
end;
$$;
grant execute on function public.admin_set_signup_paid(uuid, uuid, boolean, numeric) to authenticated;
