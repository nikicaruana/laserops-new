-- =============================================================================
-- Which team COLOUR each squad plays as, for ladder / casual squad-vs-squad
-- matches. Admins assign these around go-live so the match report can show the
-- squad badge per colour and (later) the winner can be derived from team scores.
-- Plain text colours matching public.teams.colour; nullable until assigned.
-- =============================================================================
alter table public.matches
  add column if not exists home_squad_colour text,
  add column if not exists away_squad_colour text;
