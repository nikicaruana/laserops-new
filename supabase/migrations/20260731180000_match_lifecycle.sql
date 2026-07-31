-- =============================================================================
-- Match lifecycle (Match Manager, Phase 1) — add status + processing metadata
-- to public.matches so a single row can move through its whole life:
--   scheduled -> confirmed -> live -> completed  (or cancelled)
-- and the admin Match Manager can show, per game:
--   scheduled date/time, source file type (json/csv), XP-distributed status,
--   ELO-calculated status.
-- No new RLS/grants needed: matches already has public_read + admin_all + grants.
-- Existing rows are legacy imports: fully-processed, completed games -> backfill.
-- =============================================================================

alter table public.matches
  add column if not exists status text not null default 'scheduled'
    check (status in ('scheduled', 'confirmed', 'live', 'completed', 'cancelled')),
  add column if not exists scheduled_at timestamptz,
  add column if not exists source_file_type text
    check (source_file_type is null or source_file_type in ('json', 'csv')),
  add column if not exists xp_distributed_at timestamptz,
  add column if not exists elo_calculated_at timestamptz;

-- Backfill legacy rows (everything already in the table is a completed game).
update public.matches set status = 'completed' where status = 'scheduled';

-- Give legacy games a timestamp to sort by (they only carry a date).
update public.matches
  set scheduled_at = played_on::timestamptz
  where scheduled_at is null and played_on is not null;

-- Mark legacy games whose player aggregates already carry XP / ELO as done.
update public.matches m
  set xp_distributed_at = coalesce(m.played_on::timestamptz, m.created_at)
  where m.xp_distributed_at is null
    and exists (
      select 1 from public.match_player_aggregate a
      where a.match_id = m.id and a.xp_total is not null
    );

update public.matches m
  set elo_calculated_at = coalesce(m.played_on::timestamptz, m.created_at)
  where m.elo_calculated_at is null
    and exists (
      select 1 from public.match_player_aggregate a
      where a.match_id = m.id and a.elo_after is not null
    );

create index if not exists matches_status_scheduled_idx
  on public.matches (status, scheduled_at desc);
