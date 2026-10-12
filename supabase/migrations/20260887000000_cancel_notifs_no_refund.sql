-- =============================================================================
-- Pay-after-game: cancellation notifications carry NO refund language. Money only
-- changes hands after a game is played, so a cancelled game has nothing to refund.
--  * Give match_cancelled a branded email (reuse the refund variant's shell with
--    the refund line reworded) so cancelled players still get an email.
--  * admin_cancel_match now always emits match_cancelled (no refund variant, no
--    refund_status flagging).
--  * Retire match_cancelled_refund (never emitted under pay-after).
-- =============================================================================

update public.notification_types mc set
  sends_email = true,
  email_subject = 'Your LaserOps game was cancelled',
  email_html = replace(
    (select email_html from public.notification_types where key = 'match_cancelled_refund'),
    'A full refund is on its way to your original payment method. Sorry for the let down; we hope to get you back on the field soon.',
    'Nothing was charged, so there is nothing to settle. Sorry for the let down; we hope to get you back on the field soon.'
  )
  from (select 1) _
  where mc.key = 'match_cancelled';

update public.notification_types set is_active = false where key = 'match_cancelled_refund';

create or replace function public.admin_cancel_match(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m record; pri integer;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  select id, status, title into m from public.matches where id = p_match_id;
  if m.id is null then raise exception 'Match not found.'; end if;
  if m.status in ('completed', 'cancelled') then return; end if;

  update public.matches set status = 'cancelled' where id = p_match_id;

  -- Pay-after-game: nothing is charged at sign-up, so a cancelled game has nothing
  -- to refund. Notify every registered player (no refund flagging / variant).
  select priority into pri from public.notification_types where key = 'match_cancelled' and is_active;
  if pri is null then return; end if;

  insert into public.notifications (account_id, type_key, priority, title, body, href, data)
  select s.account_id, 'match_cancelled', pri,
         coalesce(m.title, 'Your game') || ' was cancelled',
         'This game was cancelled.',
         '/player-portal/games/' || p_match_id::text,
         jsonb_build_object('matchLabel', coalesce(m.title, 'Your game'))
  from public.match_signups s
  where s.match_id = p_match_id and s.status = 'registered';
end;
$$;
