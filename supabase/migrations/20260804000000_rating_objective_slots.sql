-- =============================================================================
-- Rating v2 — two generic objective-play slots, per-mode objective mapping,
-- online-scoped objective career stats + extended eligibility, drop Score.
-- =============================================================================
-- The overall rating gains two generic "objective play" components (slot 1 /
-- slot 2). Each game mode declares which of its objective stats feed slot 1 and
-- slot 2 (LaserOps Domination: slot 1 = hold time, slot 2 = captures). Keeping
-- the slots generic lets objective play stay comparable across modes as new
-- modes are added, without minting a new rating key per mode.
--
-- Objective data only exists for ONLINE-scored matches, so:
--   * career objective stats (obj1/obj2 per round) aggregate ONLINE games only;
--   * a player is only rated once they have >= Min_Matches ONLINE-scored games
--     (so every rated player has real objective data). Once eligible, the
--     cross-mode components (wins, rounds W/L, kills, damage, accuracy, K/D,
--     Match Rating) still use ALL their games — online and offline.
--
-- Score/round is dropped from the rating (online vs offline scores aren't
-- comparable). Match Rating stays — it's a relative measure, so mode-fair.
-- Score's freed 20% weight is seeded into the two objective slots (10% each).
-- =============================================================================

-- 1. Per-mode objective -> slot mapping ---------------------------------------
alter table public.game_modes
  add column if not exists obj_slot1_stat text,
  add column if not exists obj_slot2_stat text;

comment on column public.game_modes.obj_slot1_stat is
  'Objective stat feeding rating Objective Play 1 for this mode: captures | hold_seconds | null.';
comment on column public.game_modes.obj_slot2_stat is
  'Objective stat feeding rating Objective Play 2 for this mode: captures | hold_seconds | null.';

update public.game_modes
   set obj_slot1_stat = 'hold_seconds', obj_slot2_stat = 'captures'
 where slug = 'domination';

-- 2. Matches carry their game mode (default mode until ingest sets otherwise) --
alter table public.matches
  add column if not exists mode_slug text not null default 'domination';

-- 3. Lifetime read-model: online-scoped games + objective-per-round -----------
alter table public.player_stats_lifetime
  add column if not exists online_games       integer,
  add column if not exists online_rounds      integer,
  add column if not exists total_captures     integer,
  add column if not exists total_hold_seconds numeric,
  add column if not exists obj1_per_round      numeric,
  add column if not exists obj2_per_round      numeric;

-- 4. Ratings table: two objective star components -----------------------------
alter table public.player_ratings
  add column if not exists s_obj1 integer,
  add column if not exists s_obj2 integer;

-- 5. rating_config: drop Score + old single Objective, seed two slots ---------
delete from public.rating_config where key in ('Score_Rating', 'Objective_Rating');
insert into public.rating_config (key, value, note) values
  ('Objective_1_Rating', 0.10, 'Overall-rating component weight — objective play slot 1 (weights sum to 1)'),
  ('Objective_2_Rating', 0.10, 'Overall-rating component weight — objective play slot 2 (weights sum to 1)')
on conflict (operator_id, key) do update
  set value = excluded.value, note = excluded.note, updated_at = now();

-- 6. refresh_player_stats_lifetime() — online games + obj1/obj2 per round -----
create or replace function public.refresh_player_stats_lifetime()
returns integer language plpgsql
security definer set search_path = public as $$
declare n integer;
begin
  delete from public.player_stats_lifetime where true;
  insert into public.player_stats_lifetime (
    account_id, nickname, profile_pic_url, games, rounds, wins, losses, win_rate,
    total_kills, total_deaths, total_hits, total_shots, total_wounds, total_damage, total_score,
    kills_per_round, deaths_per_round, damage_per_round, score_per_round,
    avg_accuracy, avg_kd, avg_match_rating, current_elo, current_level, total_xp,
    rounds_won, rounds_lost,
    online_games, online_rounds, total_captures, total_hold_seconds, obj1_per_round, obj2_per_round,
    updated_at)
  select
    x.account_id, x.ops_tag, x.profile_pic_url, count(*), sum(x.round_count),
    count(*) filter (where x.was_winner), count(*) filter (where x.was_winner is not true),
    round(count(*) filter (where x.was_winner)::numeric / nullif(count(*),0), 4),
    sum(x.frags), sum(x.deaths), sum(x.hits), sum(x.shots), sum(x.wounds), sum(x.damage), sum(x.score),
    round(sum(x.frags)::numeric  / nullif(sum(x.round_count),0), 3),
    round(sum(x.deaths)::numeric / nullif(sum(x.round_count),0), 3),
    round(sum(x.damage)          / nullif(sum(x.round_count),0), 2),
    round(sum(x.score)           / nullif(sum(x.round_count),0), 2),
    round(avg(x.accuracy), 4), round(avg(x.kd), 3), round(avg(x.match_rating), 2),
    (array_agg(x.elo_after   order by x.played_on desc nulls last, x.sequence_no desc))[1],
    (array_agg(x.level_after order by x.played_on desc nulls last, x.sequence_no desc))[1],
    sum(x.xp_total), sum(x.rounds_won), sum(x.rounds_lost),
    count(*) filter (where x.is_online),
    coalesce(sum(x.round_count) filter (where x.is_online), 0),
    sum(x.captures)     filter (where x.is_online),
    sum(x.hold_seconds) filter (where x.is_online),
    round(sum(x.slot1_value) filter (where x.is_online) / nullif(sum(x.round_count) filter (where x.is_online), 0), 3),
    round(sum(x.slot2_value) filter (where x.is_online) / nullif(sum(x.round_count) filter (where x.is_online), 0), 3),
    now()
  from (
    select mpa.account_id, a.ops_tag, a.profile_pic_url,
           mpa.was_winner, mpa.frags, mpa.deaths, mpa.hits, mpa.shots, mpa.wounds, mpa.damage, mpa.score,
           mpa.accuracy, mpa.kd, mpa.match_rating, mpa.elo_after, mpa.level_after, mpa.xp_total,
           mpa.rounds_won, mpa.rounds_lost, mpa.captures, mpa.hold_seconds,
           m.round_count, m.played_on, m.sequence_no,
           (m.scoring_mode = 'online') as is_online,
           case gm.obj_slot1_stat
             when 'captures'     then coalesce(mpa.captures, 0)::numeric
             when 'hold_seconds' then coalesce(mpa.hold_seconds, 0)
             else 0 end as slot1_value,
           case gm.obj_slot2_stat
             when 'captures'     then coalesce(mpa.captures, 0)::numeric
             when 'hold_seconds' then coalesce(mpa.hold_seconds, 0)
             else 0 end as slot2_value
    from public.match_player_aggregate mpa
    join public.matches m on mpa.match_id = m.id
    join public.accounts a on a.id = mpa.account_id
    left join public.game_modes gm on gm.slug = m.mode_slug
    where mpa.account_id is not null
  ) x
  group by x.account_id, x.ops_tag, x.profile_pic_url;
  get diagnostics n = row_count; return n;
end;
$$;

-- 7. refresh_player_ratings() — drop Score, add obj slots, online eligibility --
create or replace function public.refresh_player_ratings()
returns integer language plpgsql
security definer set search_path = public as $$
declare op uuid := '00000000-0000-0000-0000-000000000001';
        min_level numeric; min_matches numeric; min_pool numeric; pool int; n int;
begin
  delete from public.player_ratings where true;
  select value into min_level   from public.rating_config where operator_id=op and key='Min_Level';
  select value into min_matches from public.rating_config where operator_id=op and key='Min_Matches';
  select value into min_pool    from public.rating_config where operator_id=op and key='Min_Eligible_Pool';

  -- Eligible = level gate AND >= Min_Matches ONLINE-scored games, so every rated
  -- player has genuine objective data. Cross-mode components then use ALL games.
  select count(*) into pool from public.player_stats_lifetime
    where coalesce(current_level,0) >= min_level and coalesce(online_games,0) >= min_matches;
  if pool < min_pool then return 0; end if;   -- pool too small: nobody rated

  insert into public.player_ratings
    (account_id, nickname, profile_pic_url, s_match_win, s_rounds_wl, s_kills, s_damage,
     s_accuracy, s_kd, s_match_rating, s_obj1, s_obj2, rating_raw, rating_overall)
  with w as (
    select max(value) filter (where key='Match_Win_Rating')       as w_win,
           max(value) filter (where key='Rounds_WL_Rating')       as w_rounds,
           max(value) filter (where key='Kills_Per_Match_Rating') as w_kills,
           max(value) filter (where key='Damage_Rating')          as w_damage,
           max(value) filter (where key='Accuracy_Rating')        as w_acc,
           max(value) filter (where key='KD_Rating')              as w_kd,
           max(value) filter (where key='Match_Rating_Rating')    as w_match,
           max(value) filter (where key='Objective_1_Rating')     as w_obj1,
           max(value) filter (where key='Objective_2_Rating')     as w_obj2
    from public.rating_config where operator_id=op
  ),
  elig as (
    select account_id, win_rate,
           coalesce(rounds_won,0)::numeric / nullif(coalesce(rounds_won,0)+coalesce(rounds_lost,0),0) as rounds_wl,
           kills_per_round, damage_per_round, avg_accuracy, avg_kd, avg_match_rating,
           obj1_per_round, obj2_per_round
    from public.player_stats_lifetime
    where coalesce(current_level,0) >= min_level and coalesce(online_games,0) >= min_matches
  ),
  ranked as (
    select account_id,
      public.rating_bracket(percent_rank() over (order by win_rate))         as s_win,
      public.rating_bracket(percent_rank() over (order by rounds_wl))        as s_rounds,
      public.rating_bracket(percent_rank() over (order by kills_per_round))  as s_kills,
      public.rating_bracket(percent_rank() over (order by damage_per_round)) as s_damage,
      public.rating_bracket(percent_rank() over (order by avg_accuracy))     as s_acc,
      public.rating_bracket(percent_rank() over (order by avg_kd))           as s_kd,
      public.rating_bracket(percent_rank() over (order by avg_match_rating)) as s_match,
      public.rating_bracket(percent_rank() over (order by obj1_per_round))   as s_obj1,
      public.rating_bracket(percent_rank() over (order by obj2_per_round))   as s_obj2
    from elig
  )
  select r.account_id, a.ops_tag, a.profile_pic_url,
         r.s_win, r.s_rounds, r.s_kills, r.s_damage, r.s_acc, r.s_kd, r.s_match, r.s_obj1, r.s_obj2,
         round(c.raw, 3),
         case when c.raw < 2.5 then 2 when c.raw < 3.5 then 3 when c.raw < 4.5 then 4 else 5 end
  from ranked r
  cross join w
  join public.accounts a on a.id = r.account_id,
  lateral (select (r.s_win*w.w_win + r.s_rounds*w.w_rounds + r.s_kills*w.w_kills + r.s_damage*w.w_damage
                 + r.s_acc*w.w_acc + r.s_kd*w.w_kd + r.s_match*w.w_match
                 + coalesce(r.s_obj1,0)*coalesce(w.w_obj1,0)
                 + coalesce(r.s_obj2,0)*coalesce(w.w_obj2,0)) as raw) c;
  get diagnostics n = row_count; return n;
end;
$$;
