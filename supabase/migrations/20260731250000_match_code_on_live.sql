-- =============================================================================
-- Assign match_code only when a match actually goes live (or is completed).
-- Assigning it at creation burns LO-YYYY-NN numbers on tentative/confirmed
-- bookings that may be cancelled, leaving gaps. Instead assign on the
-- transition into 'live' (or a direct-to-'completed' import). Codes stay
-- contiguous and only real games get one.
-- =============================================================================

create or replace function public.matches_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  yr  integer;
  seq integer;
begin
  if new.created_by is null then
    new.created_by := public.current_account_id();
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

drop trigger if exists trg_matches_before_insert on public.matches;
drop trigger if exists trg_matches_before_write on public.matches;
create trigger trg_matches_before_write
  before insert or update on public.matches
  for each row execute function public.matches_before_write();

-- Release codes/sequence numbers held by bookings that aren't live yet
-- (e.g. the test private booking), so they don't leave gaps. Legacy completed
-- games keep theirs.
update public.matches
  set match_code = null, sequence_no = null, year = null
  where status in ('tentative', 'awaiting_confirm', 'confirmed');
