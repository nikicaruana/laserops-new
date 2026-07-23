-- =============================================================================
-- matches + match_player_aggregate (§4.2, §4.5) — STRUCTURE ONLY
-- =============================================================================
-- Legacy migrates at MATCH level: each Game_Data_Lookup GameId is one whole
-- match (~5 rounds aggregated), so there is no per-round player breakdown for
-- history. The round-hierarchy tables are deferred to the 2.0 JSON ingestion.
--
--   matches                -> one per match (from Game_ID_Map)
--   match_player_aggregate -> one per player per match (from Game_Data_Lookup)
--
-- round_count is stored so 2.0 per-round metrics can normalize legacy
-- aggregates (stat / round_count); counts vary (4 or 5), so it's not hardcoded.
-- Game stats are public (not PII), so this data may be committed later.
-- =============================================================================

create table public.matches (
  id                 uuid primary key default gen_random_uuid(),
  operator_id        uuid not null default '00000000-0000-0000-0000-000000000001'
                       references public.operators(id) on delete cascade,
  match_code         text not null,                       -- LO-YYYY-NN
  year               integer,
  sequence_no        integer,                             -- per-year game number
  played_on          date,
  source_game_id     text,                                -- software GameId (idempotency)
  scoring_era_id     uuid references public.scoring_eras(id),
  is_private         boolean not null default false,
  is_double_xp       boolean not null default false,
  teams_stable       boolean not null default true,       -- legacy: teams didn't shuffle
  round_count        integer,                             -- total rounds (sum of round wins)
  winning_team_colour text,                               -- -> teams.colour
  net_result_summary jsonb,                               -- round-win split, ratings, winner/loser
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (operator_id, match_code)
);
create index matches_source_game_id_idx on public.matches (source_game_id) where source_game_id is not null;
create trigger trg_matches_updated_at before update on public.matches
  for each row execute function public.set_updated_at();

create table public.match_player_aggregate (
  id                      uuid primary key default gen_random_uuid(),
  operator_id             uuid not null default '00000000-0000-0000-0000-000000000001'
                            references public.operators(id) on delete cascade,
  match_id                uuid not null references public.matches(id) on delete cascade,
  account_id              uuid references public.accounts(id),   -- linked by ops_tag; null if unresolved
  nickname                text,                                  -- LaserOps_Nickname (display name at match time)
  headset_label           text,                                  -- PlayerNickName (raw headband, e.g. "Head 07")
  team_colour             text,                                  -- -> teams.colour
  gun_used                text,                                  -- -> guns.name
  profile_pic_url         text,
  -- raw counts (summed across the match's rounds)
  frags                   integer,
  deaths                  integer,
  hits                    integer,
  shots                   integer,
  wounds                  integer,
  revivals                integer,
  treatments              integer,
  captures                integer,
  -- derived
  accuracy                numeric,
  kd                      numeric,
  damage                  numeric,
  score                   numeric,
  match_rating            numeric,
  match_average_score     numeric,
  score_performance_delta numeric,
  -- within-match ranks
  score_rank              integer,
  kills_rank              integer,
  deaths_rank             integer,
  kd_rank                 integer,
  accuracy_rank           integer,
  damage_rank             integer,
  -- result
  was_winner              boolean,
  rounds_won              integer,
  rounds_lost             integer,
  team_score              numeric,
  opponent_team_score     numeric,
  -- net ELO for the match
  elo_before              numeric,
  elo_change              numeric,
  elo_after               numeric,
  -- XP for the match
  xp_from_points          integer,
  xp_from_wins            integer,
  xp_from_accolades       integer,
  xp_total                integer,
  level_before            integer,
  level_after             integer,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (match_id, headset_label)                               -- one row per player-device per match
);
create index mpa_match_idx   on public.match_player_aggregate (match_id);
create index mpa_account_idx on public.match_player_aggregate (account_id) where account_id is not null;
create trigger trg_mpa_updated_at before update on public.match_player_aggregate
  for each row execute function public.set_updated_at();
