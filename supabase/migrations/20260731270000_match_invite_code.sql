-- =============================================================================
-- Short invite code for shareable match links (/invite/<code>) instead of
-- exposing the raw UUID. Generated on insert; backfilled for existing rows.
-- =============================================================================

alter table public.matches add column if not exists invite_code text;

update public.matches
  set invite_code = substr(md5(gen_random_uuid()::text), 1, 8)
  where invite_code is null;

create unique index if not exists matches_invite_code_idx on public.matches (invite_code);

-- Regenerate the before-write trigger fn to also mint an invite_code on insert.
create or replace function public.matches_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  yr  integer;
  seq integer;
begin
  if new.created_by is null then
    new.created_by := public.current_account_id();
  end if;

  if new.invite_code is null then
    new.invite_code := substr(md5(gen_random_uuid()::text), 1, 8);
  end if;

  if new.match_code is null and new.status in ('live', 'completed') then
    yr := extract(year from coalesce(new.scheduled_at, new.played_on::timestamptz, now()))::int;
    select coalesce(max(sequence_no), 0) + 1 into seq
      from public.matches
      where operator_id = new.operator_id and year = yr;
    new.year        := yr;
    new.sequence_no := seq;
    new.match_code  := 'LO-' || yr::text || '-' || lpad(seq::text, 2, '0');
  end if;

  return new;
end;
$$;
