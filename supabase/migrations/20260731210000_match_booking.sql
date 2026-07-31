-- =============================================================================
-- Match booking (Phase 2a) — admin-opened games + player signups.
-- Decisions: ad-hoc games at a date/time (a "slot" is just an open match);
-- admin-opened games first (player-created matches come later).
--
-- Adds booking fields to matches, makes match_code auto-assign so a booking can
-- be created without one, and introduces match_signups with a trigger that
-- keeps denormalized counts on the match and drives the quorum transition
-- tentative <-> awaiting_confirm.
-- =============================================================================

-- --- booking fields on matches ---------------------------------------------
alter table public.matches
  add column if not exists title            text,
  add column if not exists min_players      integer not null default 10,
  add column if not exists max_players      integer,
  add column if not exists price_eur        numeric,
  add column if not exists registered_count integer not null default 0,
  add column if not exists paid_count       integer not null default 0,
  add column if not exists on_day_count     integer not null default 0,
  add column if not exists created_by       uuid references public.accounts(id);

-- --- current account helper (auth user -> accounts.id) ----------------------
create or replace function public.current_account_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.accounts where auth_user_id = auth.uid() limit 1;
$$;

-- --- auto-assign match_code (+ created_by) on insert ------------------------
-- Bookings are created without a code; assign the next LO-YYYY-NN for the
-- scheduled year so codes stay contiguous with the legacy import.
alter table public.matches alter column match_code drop not null;

create or replace function public.matches_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  yr  integer;
  seq integer;
begin
  if new.match_code is null then
    yr := extract(year from coalesce(new.scheduled_at, now()))::int;
    select coalesce(max(sequence_no), 0) + 1 into seq
      from public.matches
      where operator_id = new.operator_id and year = yr;
    new.year        := yr;
    new.sequence_no := seq;
    new.match_code  := 'LO-' || yr::text || '-' || lpad(seq::text, 2, '0');
  end if;
  if new.created_by is null then
    new.created_by := public.current_account_id();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_matches_before_insert on public.matches;
create trigger trg_matches_before_insert before insert on public.matches
  for each row execute function public.matches_before_insert();

-- --- match_signups ----------------------------------------------------------
create table if not exists public.match_signups (
  id              uuid primary key default gen_random_uuid(),
  operator_id     uuid not null default '00000000-0000-0000-0000-000000000001'
                    references public.operators(id) on delete cascade,
  match_id        uuid not null references public.matches(id) on delete cascade,
  account_id      uuid not null references public.accounts(id) on delete cascade,
  payment_intent  text not null default 'online' check (payment_intent in ('online', 'on_day')),
  status          text not null default 'registered' check (status in ('registered', 'waitlisted', 'cancelled')),
  paid_at         timestamptz,
  paid_amount_eur numeric,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (match_id, account_id)
);
create index if not exists match_signups_match_idx   on public.match_signups (match_id);
create index if not exists match_signups_account_idx on public.match_signups (account_id);
create trigger trg_match_signups_updated_at before update on public.match_signups
  for each row execute function public.set_updated_at();

-- --- counts + quorum transition ---------------------------------------------
create or replace function public.sync_match_quorum()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  mid uuid;
  reg integer;
  paid integer;
  onday integer;
  m record;
begin
  mid := coalesce(new.match_id, old.match_id);

  select
    count(*) filter (where status = 'registered'),
    count(*) filter (where status = 'registered' and paid_at is not null),
    count(*) filter (where status = 'registered' and payment_intent = 'on_day')
  into reg, paid, onday
  from public.match_signups where match_id = mid;

  update public.matches
    set registered_count = reg, paid_count = paid, on_day_count = onday
    where id = mid;

  select status, min_players, reached_quorum_at into m from public.matches where id = mid;

  -- Only auto-toggle between tentative and awaiting_confirm; once an admin has
  -- confirmed (or it's live/completed/cancelled), leave the status alone.
  if reg >= m.min_players and m.status = 'tentative' then
    update public.matches
      set status = 'awaiting_confirm', reached_quorum_at = coalesce(m.reached_quorum_at, now())
      where id = mid;
  elsif reg < m.min_players and m.status = 'awaiting_confirm' then
    update public.matches
      set status = 'tentative', reached_quorum_at = null
      where id = mid;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_match_signups_quorum on public.match_signups;
create trigger trg_match_signups_quorum
  after insert or update or delete on public.match_signups
  for each row execute function public.sync_match_quorum();

-- --- RLS + grants -----------------------------------------------------------
alter table public.match_signups enable row level security;

drop policy if exists match_signups_admin_all on public.match_signups;
create policy match_signups_admin_all on public.match_signups
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists match_signups_read_own on public.match_signups;
create policy match_signups_read_own on public.match_signups
  for select to authenticated using (account_id = public.current_account_id());

-- Sign self up, but only to a match that's still open, and not past capacity.
drop policy if exists match_signups_insert_own on public.match_signups;
create policy match_signups_insert_own on public.match_signups
  for insert to authenticated with check (
    account_id = public.current_account_id()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.status in ('tentative', 'awaiting_confirm')
        and (m.max_players is null or m.registered_count < m.max_players)
    )
  );

drop policy if exists match_signups_update_own on public.match_signups;
create policy match_signups_update_own on public.match_signups
  for update to authenticated
  using (account_id = public.current_account_id())
  with check (account_id = public.current_account_id());

drop policy if exists match_signups_delete_own on public.match_signups;
create policy match_signups_delete_own on public.match_signups
  for delete to authenticated using (account_id = public.current_account_id());

grant select, insert, update, delete on public.match_signups to authenticated;
