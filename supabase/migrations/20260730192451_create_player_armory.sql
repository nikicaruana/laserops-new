-- =============================================================================
-- player_armory (§4.16) — per player × gun unlock state + per-gun stats
-- =============================================================================
-- Read-model migrated from the Player_Armory sheet (which precomputes the
-- unlock state + progress + per-gun performance). One row per (player, gun).
-- Player_Email (PII) is deliberately NOT migrated. Public-read like the other
-- read-models; populated by the gen_player_armory import.
-- =============================================================================

create table public.player_armory (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid not null default '00000000-0000-0000-0000-000000000001'
                  references public.operators(id) on delete cascade,
  account_id    uuid references public.accounts(id),   -- linked by ops_tag; null if unresolved
  nickname      text not null,
  gun_name      text not null,
  -- identity / display
  profile_pic_url text,
  rank_badge_url  text,
  player_level    integer,
  -- gun meta
  gun_class           text,
  tree_branch         text,
  gun_used_img        text,
  gun_locked_img      text,
  is_default          boolean,
  unlock_type         text,
  unlock_prereq_class text,
  unlock_prereq_gun   text,
  unlock_req_points   numeric,
  unlock_req_level    numeric,
  unlock_display_text text,
  gun_sort_order      integer,
  gun_display_title   text,
  -- per-gun stats
  matches_used         integer,
  kills_total          integer,
  avg_kills            numeric,
  deaths_total         integer,
  hits_total           integer,
  shots_total          integer,
  damage_total         numeric,
  avg_damage           numeric,
  score_total          numeric,
  avg_score            numeric,
  avg_accuracy         numeric,
  kd_ratio             numeric,
  wins_using_gun       integer,
  rounds_won_using_gun integer,
  avg_match_rating     numeric,
  -- unlock state / progress (precomputed)
  points_with_prereq_class  numeric,
  points_with_prereq_gun    numeric,
  points_toward_unlock      numeric,
  gun_is_unlocked           boolean,
  gun_player_status         text,
  gun_player_image          text,
  unlock_progress_pct       numeric,
  unlock_progress_remaining numeric,
  unlock_progress_text      text,
  has_used_gun              boolean,
  -- display extras
  gun_mag_size  integer,
  gun_damage    numeric,
  gun_reload    numeric,
  gun_fire_rate text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (operator_id, nickname, gun_name)
);
create index player_armory_nick_idx    on public.player_armory (lower(nickname));
create index player_armory_account_idx on public.player_armory (account_id) where account_id is not null;

alter table public.player_armory enable row level security;
create policy player_armory_public_read on public.player_armory
  for select to anon, authenticated using (true);
grant select on public.player_armory to anon, authenticated;
