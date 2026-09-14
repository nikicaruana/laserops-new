-- 20260803000000_offline_scoring.sql
-- Dual online/offline scoring support.
--   * match_ingest_rounds.mode: tags an ingested file as online (JSON event
--     stream) or offline (one .lwa/CSV aggregate for the whole match). This is
--     the authoritative routing flag for the scorer.
--   * matches.offline_round_results: marshal-entered round winners for an
--     offline match (the .lwa carries no winner). Array of colour strings in
--     round order, e.g. ["Blue","Red","Blue"].
--   * all_gun_damage_at(): resolves every gun's damage-per-hit in effect on a
--     given date, so the offline scorer can reconstruct damage = hits x gun
--     damage without N round-trips.

alter table public.match_ingest_rounds
  add column if not exists mode text not null default 'online'
    check (mode in ('online', 'offline'));

alter table public.matches
  add column if not exists offline_round_results jsonb;

-- Every gun's damage in effect at p_at (date-scoped, so past games keep their
-- value). Includes the hidden "Unknown Gun" fallback used for un-rostered
-- headbands. security definer so the ingest path can read it uniformly.
create or replace function public.all_gun_damage_at(p_at timestamptz)
returns table (name text, damage numeric)
language sql
stable
security definer
set search_path = public
as $$
  select g.name, public.gun_damage_at(g.id, p_at) as damage
  from public.guns g;
$$;

grant execute on function public.all_gun_damage_at(timestamptz) to authenticated;
