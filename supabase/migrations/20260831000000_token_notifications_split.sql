-- =============================================================================
-- Split + correct the token notifications.
--
-- Before: tokens_granted ("Game tokens added") fired only on a BUNDLE PURCHASE,
-- but its email was a copy of the GIFT email (band "Tokens Gifted" + footer
-- "someone gifted you ..."). Admin-granted tokens notified the player of nothing.
--
-- After:
--   * tokens_granted       = you BOUGHT tokens (self-purchase). Email corrected.
--   * tokens_admin_granted = NEW: a LaserOps admin credited tokens to you.
--   * tokens_gifted        = someone gifted you tokens; the email now shows the
--                            gifter prominently via {{gifterName}}.
-- =============================================================================

-- 1) Correct the purchase email: it is not a gift.
update public.notification_types
  set email_html = replace(
        replace(email_html, '>Tokens Gifted</div>', '>Tokens Added</div>'),
        'You received this because someone gifted you LaserOps game tokens.',
        'You received this because you bought LaserOps game tokens.')
  where key = 'tokens_granted';

-- 2) tokens_gifted: show who gifted, under the heading.
update public.notification_types
  set email_html = replace(email_html,
        'You&rsquo;ve got game tokens, {{nickname}}!</h1>',
        'You&rsquo;ve got game tokens, {{nickname}}!</h1>
                <p style="margin:-6px 0 20px 0; font-size:15px; line-height:1.4; color:#ffde00; font-weight:800;">From {{gifterName}}</p>')
  where key = 'tokens_gifted' and position('{{gifterName}}' in email_html) = 0;

-- 3) NEW type: admin-granted tokens. Clone the corrected purchase email, swap the
--    footer wording. {{body}} carries the admin-specific message.
insert into public.notification_types
  (key, label, description, priority, is_active, sends_email, email_subject, email_html, sends_push, delay_hours, sort_order, bell_title, bell_body)
select 'tokens_admin_granted',
       'Game tokens added by an admin',
       'Sent when an admin credits game tokens to a player''s account.',
       2, true, true, 'Game tokens added to your account',
       replace(email_html,
         'You received this because you bought LaserOps game tokens.',
         'You received this because a LaserOps admin added game tokens to your account.'),
       true, 0, 41,
       'Game tokens added', '{{body}}'
from public.notification_types where key = 'tokens_granted'
on conflict (key) do nothing;

-- 4) Purchase bell/email body wording (readable; the trigger renders it for both).
update public.notification_types
  set bell_body = 'Your game tokens have been added to your account.'
  where key = 'tokens_granted';

-- 5) admin_grant_tokens now notifies the player (bell + email) on a positive
--    grant, via a direct insert (rendered by the bell-template trigger).
create or replace function public.admin_grant_tokens(p_acct uuid, p_amount numeric, p_validity_months integer, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_lot uuid; amt_text text; word text;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  v_lot := public._grant_token_lot(p_acct, p_amount, 'admin',
             coalesce(p_validity_months, (select default_validity_months from public.token_config where id = 1), 6),
             null, coalesce(nullif(btrim(p_note), ''), 'Admin grant'), public.current_account_id(), null);
  if p_amount > 0 then
    amt_text := trim(to_char(p_amount, 'FM999990.##'));
    word := case when p_amount = 1 then 'token' else 'tokens' end;
    insert into public.notifications (account_id, type_key, priority, title, body, href, data)
    select p_acct, 'tokens_admin_granted', nt.priority,
           'Game tokens added',
           'A LaserOps admin added ' || amt_text || ' game ' || word || ' to your account.',
           '/player-portal/profile',
           jsonb_build_object('tokenCount', amt_text)
    from public.notification_types nt where nt.key = 'tokens_admin_granted' and nt.is_active;
  end if;
  return v_lot;
end;
$$;
grant execute on function public.admin_grant_tokens(uuid, numeric, integer, text) to authenticated;
