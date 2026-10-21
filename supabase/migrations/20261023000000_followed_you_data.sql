-- 20261023000000_followed_you_data.sql
-- The "X followed you" notification now carries the follower's ops tag in its
-- data, so the notification bell can offer a "Follow back" button without having
-- to parse it out of the href. Only the followed_you emit gains the data arg;
-- the rest of follow_player is unchanged from 20260731770000.
create or replace function public.follow_player(p_ops_tag text)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); target uuid; n integer; me_tag text;
begin
  if acct is null then raise exception 'Sign in to follow players.'; end if;
  select id into target from public.accounts where lower(ops_tag) = lower(btrim(p_ops_tag)) limit 1;
  if target is null then raise exception 'Player not found.'; end if;
  if target = acct then raise exception 'You cannot follow yourself.'; end if;
  insert into public.follows (follower_id, followee_id) values (acct, target) on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    select ops_tag into me_tag from public.accounts where id = acct;
    perform public.emit_notification(target, 'followed_you',
      coalesce(me_tag, 'Someone') || ' followed you', null,
      '/player-portal/player-stats/summary?ops=' || coalesce(me_tag, ''),
      jsonb_build_object('ops_tag', me_tag));
  end if;
end;
$$;
