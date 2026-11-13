-- Game style for a match. '1v1_default' is the standard two-team game we've run
-- for everything so far (the default). '1v1v1_round_robin' is a three-team
-- round-robin: teams play each other two teams at a time across the rounds, and
-- the overall winner is the team that wins the most rounds. The style is an admin
-- setting on the game; scoring stays per-round two-team either way, so this column
-- only drives admin labelling and the report's multi-team presentation.
alter table public.matches
  add column if not exists game_style text not null default '1v1_default';

alter table public.matches drop constraint if exists matches_game_style_check;
alter table public.matches add constraint matches_game_style_check
  check (game_style in ('1v1_default', '1v1v1_round_robin'));
