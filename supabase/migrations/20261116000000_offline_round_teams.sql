-- Participating teams per offline round, parallel to matches.offline_round_results
-- (the winners). Each element is the list of team colours that played that offline
-- round, e.g. [["Red","Blue"],["Red","Blue"],["Blue","Green"], ...]. Needed for the
-- 1v1v1 round robin, where each team only plays some of the rounds: without it the
-- offline scorer assumes everyone played every round and charges sat-out rounds as
-- losses (wrong win-rate + Elo). Null/absent -> fall back to "everyone played all
-- rounds" (unchanged for existing offline games).
alter table public.matches
  add column if not exists offline_round_teams jsonb;
