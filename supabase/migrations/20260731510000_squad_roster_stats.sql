-- Extend squad_roster to power member cards: profile photo + main rating + ELO
-- (from player_stats_lifetime). Return type changes, so drop + recreate.
drop function if exists public.squad_roster(uuid);
create or replace function public.squad_roster(p_squad_id uuid)
returns table (
  account_id       uuid,
  ops_tag          text,
  profile_pic_url  text,
  role             text,
  is_primary       boolean,
  elo              numeric,
  rating           numeric,
  level            integer,
  joined_at        timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_view_squad(p_squad_id) then
    raise exception 'Not allowed.';
  end if;
  return query
    select sm.account_id, a.ops_tag, a.profile_pic_url, sm.role, sm.is_primary,
           s.current_elo, s.avg_match_rating, s.current_level, sm.joined_at
    from public.squad_members sm
    join public.accounts a on a.id = sm.account_id
    left join public.player_stats_lifetime s on s.account_id = sm.account_id
    where sm.squad_id = p_squad_id
    order by (sm.role = 'captain') desc, (sm.role = 'officer') desc, sm.joined_at;
end;
$$;
grant execute on function public.squad_roster(uuid) to authenticated;
