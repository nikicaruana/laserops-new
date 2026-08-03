-- =============================================================================
-- extra_headbands — a roster player can end up on more than one headband when
-- one malfunctions mid-game and they're issued another. Ingestion merges the
-- scores from every headband (primary headset_label + these extras) into the
-- one player.
-- =============================================================================

alter table public.match_participants
  add column if not exists extra_headbands text[] not null default '{}';
