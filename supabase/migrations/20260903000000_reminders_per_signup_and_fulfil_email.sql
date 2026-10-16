-- =============================================================================
-- 1) Per-signup reminder tracking.
--    The "Your upcoming LaserOps match" reminder was tracked per MATCH
--    (matches.reminder_sent_at), so a player who signed up AFTER the match was
--    reminded never got the email. Track it per signup instead; the cron now
--    reminds any registered signup inside the 24h window whose reminder_sent_at
--    is null, so late joiners are covered on the next run.
-- 2) Email the player when an admin fulfils their token pack request.
--    admin_fulfil_token_pack_request granted the tokens but never notified the
--    player. Emit the tokens_granted notification (in-app bell + email via the
--    dispatch cron) when the pack is fulfilled.
-- =============================================================================

alter table public.match_signups add column if not exists reminder_sent_at timestamptz;

create or replace function public.admin_fulfil_token_pack_request(p_request_id uuid, p_method text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; actor uuid := public.current_account_id(); meth text;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Two-factor authentication is required to grant tokens.';
  end if;
  select * into r from public.token_pack_requests where id = p_request_id;
  if r.id is null then raise exception 'Request not found.'; end if;
  if r.status <> 'pending' then raise exception 'This request is already %.', r.status; end if;

  perform public._grant_token_lot(
    r.account_id, r.tokens, 'purchase', coalesce(r.validity_months, 6), null,
    'Token pack: ' || r.bundle_name, actor, null
  );

  meth := nullif(btrim(coalesce(p_method, '')), '');
  if meth is not null and meth in ('cash','revolut','card','bank') then
    insert into public.financial_entries (direction, category, amount_eur, method, account_id, match_id, source, note)
      values ('payment', 'tokens', r.price_eur, meth, r.account_id, null, 'token_manual',
              'Token pack (' || r.bundle_name || ', ' || meth || ')');
  end if;

  update public.token_pack_requests set status = 'fulfilled', handled_at = now(), handled_by = actor where id = r.id;
  delete from public.admin_notifications where dedupe_key = 'token_pack_request:' || r.id::text;

  -- Notify the player their tokens are in (bell + email via the dispatch cron).
  perform public.emit_notification(
    r.account_id, 'tokens_granted',
    r.bundle_name || ' added',
    trim(to_char(r.tokens, 'FM990.##')) || ' game tokens have been added to your account.',
    '/player-portal/games', null, null
  );

  return jsonb_build_object('ok', true, 'tokens', r.tokens);
end;
$$;
grant execute on function public.admin_fulfil_token_pack_request(uuid, text) to authenticated;
