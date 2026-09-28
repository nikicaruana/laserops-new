-- =============================================================================
-- Functional level rewards: XP-boost tokens (2x, 1.5x) + game tokens granted at
-- levels, auto-granted on level-up. XP boosts are spent at game sign-in and
-- captured as a per-player multiplier on the match (applied when XP is computed);
-- they cannot be used in a match that is already double XP. Game-token rewards
-- reuse the existing token system (source 'milestone'). All balance writes go
-- through SECURITY DEFINER RPCs; players can only read their own.
-- =============================================================================

-- --- reward config: add XP-boost quantities to level_unlocks ----------------
alter table public.level_unlocks
  add column if not exists reward_double_xp integer not null default 0,
  add column if not exists reward_xp_1_5    integer not null default 0;

create or replace function public.admin_set_level_unlock(
  p_level integer, p_title text, p_description text, p_icon_url text,
  p_reward_tokens numeric, p_is_active boolean,
  p_reward_double_xp integer default 0, p_reward_xp_1_5 integer default 0
) returns void language plpgsql security definer set search_path = public as $$
declare op uuid := '00000000-0000-0000-0000-000000000001';
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  insert into public.level_unlocks (operator_id, level, title, description, icon_url, reward_tokens, is_active, reward_double_xp, reward_xp_1_5, updated_at)
    values (op, p_level, coalesce(btrim(p_title), ''), nullif(btrim(p_description), ''), nullif(btrim(p_icon_url), ''),
            coalesce(p_reward_tokens, 0), coalesce(p_is_active, true), greatest(coalesce(p_reward_double_xp,0),0), greatest(coalesce(p_reward_xp_1_5,0),0), now())
  on conflict (operator_id, level) do update
    set title = excluded.title, description = excluded.description, icon_url = excluded.icon_url,
        reward_tokens = excluded.reward_tokens, is_active = excluded.is_active,
        reward_double_xp = excluded.reward_double_xp, reward_xp_1_5 = excluded.reward_xp_1_5, updated_at = now();
end;
$$;
grant execute on function public.admin_set_level_unlock(integer, text, text, text, numeric, boolean, integer, integer) to authenticated;

-- --- XP-boost balances + append-only ledger ---------------------------------
create table public.player_xp_boosts (
  account_id uuid not null references public.accounts(id) on delete cascade,
  boost_type text not null check (boost_type in ('double', 'one_five')),
  balance    integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now(),
  primary key (account_id, boost_type)
);
alter table public.player_xp_boosts enable row level security;
drop policy if exists player_xp_boosts_read on public.player_xp_boosts;
create policy player_xp_boosts_read on public.player_xp_boosts for select to authenticated
  using (account_id = public.current_account_id() or public.is_admin());
grant select on public.player_xp_boosts to authenticated;
grant select, insert, update on public.player_xp_boosts to service_role;

create table public.xp_boost_ledger (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  boost_type text not null,
  delta      integer not null,
  kind       text not null check (kind in ('grant', 'spend', 'adjustment')),
  reason     text,
  match_id   uuid references public.matches(id) on delete set null,
  level      integer,
  actor_account_id uuid references public.accounts(id),
  created_at timestamptz not null default now()
);
create index xp_boost_ledger_acct_idx on public.xp_boost_ledger (account_id, created_at desc);
alter table public.xp_boost_ledger enable row level security;
drop policy if exists xp_boost_ledger_read on public.xp_boost_ledger;
create policy xp_boost_ledger_read on public.xp_boost_ledger for select to authenticated
  using (account_id = public.current_account_id() or public.is_admin());
grant select on public.xp_boost_ledger to authenticated;
grant insert on public.xp_boost_ledger to service_role;

-- per-player XP multiplier captured at sign-in (applied when XP is computed).
alter table public.match_participants add column if not exists xp_multiplier numeric not null default 1;

-- --- internal grant (balance + ledger). Server-only. ------------------------
create or replace function public._grant_xp_boost(
  p_acct uuid, p_type text, p_qty integer, p_reason text, p_level integer, p_actor uuid
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_qty is null or p_qty <= 0 then return; end if;
  if p_type not in ('double', 'one_five') then raise exception 'Unknown boost type.'; end if;
  insert into public.player_xp_boosts (account_id, boost_type, balance, updated_at)
    values (p_acct, p_type, p_qty, now())
  on conflict (account_id, boost_type) do update set balance = public.player_xp_boosts.balance + p_qty, updated_at = now();
  insert into public.xp_boost_ledger (account_id, boost_type, delta, kind, reason, level, actor_account_id)
    values (p_acct, p_type, p_qty, 'grant', p_reason, p_level, p_actor);
end;
$$;
revoke execute on function public._grant_xp_boost(uuid, text, integer, text, integer, uuid) from public, anon;
grant execute on function public._grant_xp_boost(uuid, text, integer, text, integer, uuid) to service_role;

create or replace function public.admin_grant_xp_boost(p_acct uuid, p_type text, p_qty integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  perform public._grant_xp_boost(p_acct, p_type, p_qty, 'Admin grant', null, public.current_account_id());
end;
$$;
grant execute on function public.admin_grant_xp_boost(uuid, text, integer) to authenticated;

-- --- player reads own balances ----------------------------------------------
create or replace function public.my_xp_boosts()
returns table (boost_type text, balance integer)
language sql stable security definer set search_path = public as $$
  select boost_type, balance from public.player_xp_boosts
  where account_id = public.current_account_id() and balance > 0;
$$;
grant execute on function public.my_xp_boosts() to authenticated;

-- --- spend a boost at sign-in (player; own account) -------------------------
-- Consumes one boost and records the per-player multiplier on this match. Blocked
-- when the match is already double XP, and once a boost is already applied.
create or replace function public.spend_xp_boost(p_match_id uuid, p_boost_type text)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  acct uuid := public.current_account_id();
  m record; part record; bal integer; mult numeric;
begin
  if acct is null then raise exception 'Sign in first.'; end if;
  if p_boost_type not in ('double', 'one_five') then raise exception 'Unknown boost type.'; end if;

  select id, status, is_double_xp into m from public.matches where id = p_match_id;
  if m.id is null then raise exception 'Game not found.'; end if;
  if coalesce(m.is_double_xp, false) then raise exception 'This game is already Double XP - no boost needed.'; end if;

  select id, xp_multiplier into part from public.match_participants where match_id = p_match_id and account_id = acct;
  if part.id is null then raise exception 'Join the game first, then apply your boost.'; end if;
  if coalesce(part.xp_multiplier, 1) > 1 then raise exception 'You already applied a boost to this game.'; end if;

  select balance into bal from public.player_xp_boosts where account_id = acct and boost_type = p_boost_type;
  if coalesce(bal, 0) < 1 then raise exception 'You have no %s boosts left.', case when p_boost_type = 'double' then 'Double XP' else '1.5x XP' end; end if;

  mult := case when p_boost_type = 'double' then 2 else 1.5 end;
  update public.player_xp_boosts set balance = balance - 1, updated_at = now() where account_id = acct and boost_type = p_boost_type;
  insert into public.xp_boost_ledger (account_id, boost_type, delta, kind, reason, match_id)
    values (acct, p_boost_type, -1, 'spend', 'Applied at sign-in', p_match_id);
  update public.match_participants set xp_multiplier = mult where match_id = p_match_id and account_id = acct;
  return mult;
end;
$$;
grant execute on function public.spend_xp_boost(uuid, text) to authenticated;

-- --- auto-grant level rewards on level-up -----------------------------------
create table public.player_level_rewards_state (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  last_rewarded_level integer not null default 0,
  updated_at timestamptz not null default now()
);
-- Seed to current levels so deploying this does NOT retroactively dump rewards
-- for every level a player already passed - only future level-ups are rewarded.
insert into public.player_level_rewards_state (account_id, last_rewarded_level)
  select account_id, coalesce(current_level, 0) from public.player_stats_lifetime
  on conflict (account_id) do nothing;

create or replace function public.grant_level_rewards()
returns integer language plpgsql security definer set search_path = public as $$
declare rec record; u record; lv integer; vm integer; granted integer := 0;
begin
  vm := coalesce((select default_validity_months from public.token_config where id = 1), 6);
  for rec in
    select l.account_id, coalesce(l.current_level, 0) as cur, coalesce(s.last_rewarded_level, 0) as last
    from public.player_stats_lifetime l
    left join public.player_level_rewards_state s on s.account_id = l.account_id
    where l.account_id is not null and coalesce(l.current_level, 0) > coalesce(s.last_rewarded_level, 0)
  loop
    for lv in (rec.last + 1) .. rec.cur loop
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
      values (rec.account_id, rec.cur, now())
    on conflict (account_id) do update set last_rewarded_level = excluded.last_rewarded_level, updated_at = now();
  end loop;
  return granted;
end;
$$;
revoke execute on function public.grant_level_rewards() from public, anon;
grant execute on function public.grant_level_rewards() to service_role, authenticated;

-- --- hook the auto-grant into the recompute pipeline ------------------------
create or replace function public.recompute_read_models()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c_life integer; c_period integer; c_gun integer; c_rating integer; c_stand integer; c_rewards integer;
  r jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  c_life   := public.refresh_player_stats_lifetime();
  c_period := public.refresh_leaderboard_period_stats();
  c_gun    := public.refresh_player_gun_stats();
  c_rating := public.refresh_player_ratings();
  c_stand  := public.refresh_season_challenge_standings();
  c_rewards := public.grant_level_rewards();  -- award newly-passed level rewards

  r := jsonb_build_object(
    'lifetime', c_life, 'period', c_period, 'gun_stats', c_gun,
    'ratings', c_rating, 'standings', c_stand, 'level_rewards', c_rewards
  );

  update public.read_model_status
    set last_recomputed_at = now(), last_result = r, updated_at = now()
    where operator_id = '00000000-0000-0000-0000-000000000001';

  return r;
end;
$$;
grant execute on function public.recompute_read_models() to authenticated;
