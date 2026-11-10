-- =============================================================================
-- Financial entries: effective_date, so reports can filter by GAME date or
-- PAYMENT date from one indexed column.
--
--   effective_date = game_date when set (game/drinks tied to a match), else the
--   payment day (occurred_at, Malta). So filtering on effective_date = "by game
--   date" (nothing disappears: token/other entries fall back to their payment
--   day), and filtering on occurred_at = "by payment date". The reports page
--   picks the column from a Filter-by dropdown.
--
-- The game_date/effective_date trigger now also fires on UPDATE, so editing an
-- entry's payment date keeps effective_date correct.
-- =============================================================================

alter table public.financial_entries add column if not exists effective_date date;
comment on column public.financial_entries.effective_date is
  'Reporting date: game_date when set, else occurred_at (Malta). Filter on this for a "by game date" view. Maintained by trg_financial_entry_game_date.';
create index if not exists financial_entries_effective_date_idx on public.financial_entries (effective_date);

create or replace function public.set_financial_entry_game_date()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- game_date: the day the game was played, for game/drinks tied to a match.
  if new.game_date is null and new.match_id is not null and new.category in ('game', 'drinks') then
    select coalesce(m.played_on, (m.scheduled_at at time zone 'Europe/Malta')::date)
      into new.game_date
      from public.matches m where m.id = new.match_id;
  end if;
  -- effective_date: game_date when we have one, else the payment day.
  new.effective_date := coalesce(new.game_date, (new.occurred_at at time zone 'Europe/Malta')::date);
  return new;
end;
$$;

drop trigger if exists trg_financial_entry_game_date on public.financial_entries;
create trigger trg_financial_entry_game_date
  before insert or update on public.financial_entries
  for each row execute function public.set_financial_entry_game_date();

-- Backfill effective_date for every existing row.
update public.financial_entries
   set effective_date = coalesce(game_date, (occurred_at at time zone 'Europe/Malta')::date)
 where effective_date is null;
