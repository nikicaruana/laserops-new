-- =============================================================================
-- Require two-factor (TOTP) step-up for admin token GRANTS and REFUNDS. Crediting
-- tokens is a money action, so it must not be possible from an admin session that
-- hasn't cleared 2FA - even by calling the RPC directly. Supabase raises the
-- session's assurance level to 'aal2' after a TOTP challenge; we reject anything
-- below aal2 here, so the check is enforced server-side, not just in the UI.
-- (The UI wraps the action in TotpGate, which performs the challenge first.)
-- =============================================================================

create or replace function public.admin_grant_tokens(p_acct uuid, p_amount numeric, p_validity_months integer, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Two-factor authentication is required to credit tokens.';
  end if;
  return public._grant_token_lot(p_acct, p_amount, 'admin', coalesce(p_validity_months, (select default_validity_months from public.token_config where id = 1), 6),
                                 null, coalesce(nullif(btrim(p_note), ''), 'Admin grant'), public.current_account_id(), null);
end;
$$;

create or replace function public.admin_refund_tokens(p_acct uuid, p_amount numeric, p_match_id uuid, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Two-factor authentication is required to refund tokens.';
  end if;
  return public._grant_token_lot(p_acct, p_amount, 'refund', (select default_validity_months from public.token_config where id = 1),
                                 null, coalesce(nullif(btrim(p_note), ''), 'Token refund'), public.current_account_id(), p_match_id);
end;
$$;
