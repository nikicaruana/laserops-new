-- Level rewards are earned once a level is COMPLETED, not merely reached.
-- current_level is the level a player has REACHED (in progress); a level is
-- completed only when they've moved past it (current_level > that level). So we
-- grant for levels (last+1)..(current_level - 1) and stamp state at current-1.
create or replace function public.grant_level_rewards()
returns integer language plpgsql security definer set search_path = public as $$
declare rec record; u record; lv integer; vm integer; granted integer := 0;
begin
  vm := coalesce((select default_validity_months from public.token_config where id = 1), 6);
  for rec in
    select l.account_id, coalesce(l.current_level, 0) as cur, coalesce(s.last_rewarded_level, 0) as last
    from public.player_stats_lifetime l
    left join public.player_level_rewards_state s on s.account_id = l.account_id
    where l.account_id is not null and coalesce(l.current_level, 0) - 1 > coalesce(s.last_rewarded_level, 0)
  loop
    for lv in (rec.last + 1) .. (rec.cur - 1) loop
      select * into u from public.level_unlocks
        where operator_id = '00000000-0000-0000-0000-000000000001' and level = lv and is_active;
      if found then
        if coalesce(u.reward_tokens, 0) > 0 then
          perform public._grant_token_lot(rec.account_id, u.reward_tokens, 'milestone', vm, null, 'Level ' || lv || ' reward', null, null);
        end if;
        if coalesce(u.reward_double_xp, 0) > 0 then
          perform public._grant_xp_boost(rec.account_id, 'double', u.reward_double_xp, 'Level ' || lv || ' reward', lv, null);
        end if;
        if coalesce(u.reward_xp_1_5, 0) > 0 then
          perform public._grant_xp_boost(rec.account_id, 'one_five', u.reward_xp_1_5, 'Level ' || lv || ' reward', lv, null);
        end if;
        granted := granted + 1;
      end if;
    end loop;
    insert into public.player_level_rewards_state (account_id, last_rewarded_level, updated_at)
      values (rec.account_id, greatest(rec.cur - 1, 0), now())
    on conflict (account_id) do update set last_rewarded_level = excluded.last_rewarded_level, updated_at = now();
  end loop;
  return granted;
end;
$$;
revoke execute on function public.grant_level_rewards() from public, anon;
grant execute on function public.grant_level_rewards() to service_role, authenticated;
