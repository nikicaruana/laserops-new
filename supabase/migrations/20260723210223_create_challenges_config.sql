-- =============================================================================
-- challenges + excluded_players (config) — from the CMS Challenges / Excluded tabs
-- =============================================================================
-- Season challenges (prize competitions) and the prize-ineligible player list.
-- Standings computation comes next. source_mode ∈ period_summed | period_max |
-- match_top | gun_threshold_count.
-- =============================================================================

create table public.challenges (
  id               uuid primary key default gen_random_uuid(),
  operator_id      uuid not null default '00000000-0000-0000-0000-000000000001'
                     references public.operators(id) on delete cascade,
  season_number    integer not null,
  challenge_number integer not null,
  challenge_name   text,
  description      text,
  prize            text,
  priority         integer,
  source_mode      text check (source_mode in ('period_summed','period_max','match_top','gun_threshold_count')),
  metric           text,
  tiebreak_1       text,
  tiebreak_2       text,
  top_n            integer default 50,
  prize_cutoff     integer default 2,
  threshold        numeric,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (operator_id, season_number, challenge_number)
);
create trigger trg_challenges_updated_at before update on public.challenges
  for each row execute function public.set_updated_at();

insert into public.challenges
  (season_number, challenge_number, challenge_name, description, prize, priority, source_mode, metric, tiebreak_1, top_n, prize_cutoff, threshold)
values
  (1, 1, 'XP', 'The 2 players with the highest rank / most XP by the end of the season.', '1 free open game per player + more TBA.', 1, 'period_summed', 'XP_Total', null, 50, 2, null),
  (1, 2, 'Round Wins', 'The 2 players with the most round wins by the end of the season. Tie breaks are settled by total points.', '1 free open game per player + more TBA.', 2, 'period_summed', 'Rounds_Won', 'round_win_rate_descending', 50, 2, null),
  (1, 3, 'Killing Machines', 'The 2 players with the most kills in an individual match. Ties are settled by highest KDs in those matches.', '1 free open game per player + more TBA.', 3, 'match_top', 'PlayerFragsCount', 'kd_ratio_descending', 50, 2, null),
  (2, 1, 'XP', 'The 2 players with the most XP by the end of the season.', '1 free open game per player + merch', 1, 'period_summed', 'XP_Total', null, 50, 2, null),
  (2, 2, 'Round Wins', 'The 2 players with the most round wins by the end of the season. Tie breaks are settled by total points.', '1 free open game per player + merch', 2, 'period_summed', 'Rounds_Won', 'round_win_rate_descending', 50, 2, null),
  (2, 3, 'Gunslingers', 'The 2 players with at least 75 kills on the most different guns by the end of the season.', '1 free open game per player + merch', 3, 'gun_threshold_count', 'PlayerFragsCount', null, 50, 2, 75)
on conflict (operator_id, season_number, challenge_number) do update
  set challenge_name = excluded.challenge_name, description = excluded.description, prize = excluded.prize,
      priority = excluded.priority, source_mode = excluded.source_mode, metric = excluded.metric,
      tiebreak_1 = excluded.tiebreak_1, top_n = excluded.top_n, prize_cutoff = excluded.prize_cutoff,
      threshold = excluded.threshold, updated_at = now();

create table public.excluded_players (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null default '00000000-0000-0000-0000-000000000001'
                references public.operators(id) on delete cascade,
  nickname    text not null,
  reason      text,
  status      text,
  created_at  timestamptz not null default now()
);
create unique index excluded_players_nick_uniq on public.excluded_players (operator_id, lower(nickname));

insert into public.excluded_players (nickname, reason, status) values
  ('Kyle', 'Owner', 'active'),
  ('Kini', 'Owner', 'active')
on conflict (operator_id, lower(nickname)) do update set reason = excluded.reason, status = excluded.status;
