-- =============================================================================
-- match_participants — the pre-game / in-game roster for a match: who is
-- playing, on which headband, with which gun. Two sources:
--   live_join -> a signed-up player joined the live match with the code
--   admin     -> an admin added the entry by hand (private bookings / walk-ins)
-- Ingestion later matches the imported headbands to these participants to build
-- match_player_aggregate. Headband is nullable so an admin can add a person and
-- assign the headband later; one headband per match when set.
-- =============================================================================

create table public.match_participants (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid not null default '00000000-0000-0000-0000-000000000001'
                  references public.operators(id) on delete cascade,
  match_id      uuid not null references public.matches(id) on delete cascade,
  account_id    uuid references public.accounts(id) on delete set null,  -- null for a walk-in
  headset_label text,                                                    -- headband number / label
  gun_used      text,                                                    -- -> guns.name
  display_name  text,                                                    -- label for walk-ins with no account
  source        text not null default 'live_join' check (source in ('live_join', 'admin')),
  joined_at     timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (match_id, headset_label)
);
create index match_participants_match_idx   on public.match_participants (match_id);
create index match_participants_account_idx on public.match_participants (account_id) where account_id is not null;
-- One participant row per signed-in player per match.
create unique index match_participants_match_account_idx
  on public.match_participants (match_id, account_id) where account_id is not null;
create trigger trg_match_participants_updated_at before update on public.match_participants
  for each row execute function public.set_updated_at();

-- --- RLS + grants -----------------------------------------------------------
alter table public.match_participants enable row level security;

drop policy if exists match_participants_admin_all on public.match_participants;
create policy match_participants_admin_all on public.match_participants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists match_participants_read_own on public.match_participants;
create policy match_participants_read_own on public.match_participants
  for select to authenticated using (account_id = public.current_account_id());

-- A signed-up player may join a live match (the 4-digit code is verified in the
-- join route; RLS enforces ownership + live + a registered signup).
drop policy if exists match_participants_insert_own on public.match_participants;
create policy match_participants_insert_own on public.match_participants
  for insert to authenticated with check (
    account_id = public.current_account_id()
    and exists (select 1 from public.matches m where m.id = match_id and m.status = 'live')
    and exists (
      select 1 from public.match_signups s
      where s.match_id = match_id and s.account_id = public.current_account_id() and s.status = 'registered'
    )
  );

drop policy if exists match_participants_update_own on public.match_participants;
create policy match_participants_update_own on public.match_participants
  for update to authenticated
  using (account_id = public.current_account_id())
  with check (account_id = public.current_account_id());

grant select, insert, update, delete on public.match_participants to authenticated;

-- --- join RPC ---------------------------------------------------------------
-- A signed-up player joins a live match by entering the 4-digit code. Runs as
-- definer so the code is verified server-side without ever exposing entry_code
-- to the client. Upserts the caller's roster row (one per player per match).
create or replace function public.join_live_match(
  p_match_id uuid,
  p_code     text,
  p_headband text,
  p_gun      text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  acct     uuid;
  m        record;
  existing uuid;
  hb       text := nullif(trim(p_headband), '');
begin
  acct := public.current_account_id();
  if acct is null then
    return jsonb_build_object('ok', false, 'error', 'You need to be signed in.');
  end if;

  select id, status, entry_code into m from public.matches where id = p_match_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Game not found.');
  end if;
  if m.status <> 'live' then
    return jsonb_build_object('ok', false, 'error', 'This game is not live yet.');
  end if;
  if m.entry_code is distinct from nullif(trim(p_code), '') then
    return jsonb_build_object('ok', false, 'error', 'Incorrect code.');
  end if;
  if not exists (
    select 1 from public.match_signups s
    where s.match_id = p_match_id and s.account_id = acct and s.status = 'registered'
  ) then
    return jsonb_build_object('ok', false, 'error', 'You are not signed up for this game.');
  end if;
  if hb is null then
    return jsonb_build_object('ok', false, 'error', 'Enter your headband number.');
  end if;
  if exists (
    select 1 from public.match_participants p
    where p.match_id = p_match_id and p.headset_label = hb
      and p.account_id is distinct from acct
  ) then
    return jsonb_build_object('ok', false, 'error', 'That headband is already taken by another player.');
  end if;

  select id into existing from public.match_participants
    where match_id = p_match_id and account_id = acct;

  if existing is not null then
    update public.match_participants
      set headset_label = hb, gun_used = nullif(trim(p_gun), ''), source = 'live_join', joined_at = now()
      where id = existing;
  else
    insert into public.match_participants (match_id, account_id, headset_label, gun_used, source)
      values (p_match_id, acct, hb, nullif(trim(p_gun), ''), 'live_join');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.join_live_match(uuid, text, text, text) to authenticated;
