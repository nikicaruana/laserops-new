-- Add payment status to the organizer/participant signup list so the view-game
-- screen can show who has paid. Return-type changes require a drop + recreate.
drop function if exists public.match_signups_for_organizer(uuid);

create or replace function public.match_signups_for_organizer(p_match_id uuid)
returns table (
  ops_tag text, profile_pic_url text, level integer, rank_badge_url text,
  status text, signed_up_at timestamptz, paid_at timestamptz, payment_intent text
)
language plpgsql security definer set search_path = public as $$
declare
  acct  uuid := public.current_account_id();
  owner uuid;
begin
  select created_by into owner from public.matches where id = p_match_id;
  if owner is distinct from acct
     and not public.is_admin()
     and not exists (
       select 1 from public.match_signups s
       where s.match_id = p_match_id and s.account_id = acct and s.status <> 'cancelled'
     )
  then
    raise exception 'Not allowed.';
  end if;

  return query
    select a.ops_tag, a.profile_pic_url, psl.current_level, rl.badge_url,
           s.status, s.created_at, s.paid_at, s.payment_intent
    from public.match_signups s
    join public.accounts a on a.id = s.account_id
    left join public.player_stats_lifetime psl on psl.account_id = s.account_id
    left join public.rank_levels rl on rl.level = psl.current_level
    where s.match_id = p_match_id and s.status in ('registered', 'waitlisted')
    order by (s.status = 'waitlisted'), s.created_at;
end;
$$;

grant execute on function public.match_signups_for_organizer(uuid) to authenticated;
