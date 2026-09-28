-- =============================================================================
-- Level unlocks: the reward/prize configured for each progression level. Admins
-- set what's unlocked at each level (title + description + optional icon, and an
-- optional token reward for future auto-grant). Players see these on the new
-- Progression tab. One row per (operator, level); keyed to the rank_levels
-- ladder. Public reads see only active rows; only admins write (via the RPC).
-- =============================================================================

create table public.level_unlocks (
  operator_id   uuid not null default '00000000-0000-0000-0000-000000000001'
                  references public.operators(id) on delete cascade,
  level         integer not null,
  title         text not null default '',
  description   text,
  icon_url      text,
  reward_tokens numeric(12,4) not null default 0,
  is_active     boolean not null default true,
  updated_at    timestamptz not null default now(),
  primary key (operator_id, level)
);

alter table public.level_unlocks enable row level security;

drop policy if exists level_unlocks_read on public.level_unlocks;
create policy level_unlocks_read on public.level_unlocks for select to anon, authenticated
  using (is_active or public.is_admin());
drop policy if exists level_unlocks_admin on public.level_unlocks;
create policy level_unlocks_admin on public.level_unlocks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select on public.level_unlocks to anon, authenticated;

-- Admin upsert (handles operator_id + is_admin check server-side).
create or replace function public.admin_set_level_unlock(
  p_level integer, p_title text, p_description text, p_icon_url text, p_reward_tokens numeric, p_is_active boolean
) returns void language plpgsql security definer set search_path = public as $$
declare op uuid := '00000000-0000-0000-0000-000000000001';
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  insert into public.level_unlocks (operator_id, level, title, description, icon_url, reward_tokens, is_active, updated_at)
    values (op, p_level, coalesce(btrim(p_title), ''), nullif(btrim(p_description), ''), nullif(btrim(p_icon_url), ''),
            coalesce(p_reward_tokens, 0), coalesce(p_is_active, true), now())
  on conflict (operator_id, level) do update
    set title = excluded.title, description = excluded.description, icon_url = excluded.icon_url,
        reward_tokens = excluded.reward_tokens, is_active = excluded.is_active, updated_at = now();
end;
$$;
grant execute on function public.admin_set_level_unlock(integer, text, text, text, numeric, boolean) to authenticated;
