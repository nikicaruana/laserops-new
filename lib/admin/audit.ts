/**
 * lib/admin/audit.ts
 * --------------------------------------------------------------------
 * Helpers for rendering admin_audit_log entries: friendly table labels and a
 * plain-English description of each change.
 */

export type AuditEntry = {
  id: number;
  actor_ops_tag: string | null;
  table_name: string;
  row_id: string | null;
  action: string; // INSERT | UPDATE | DELETE
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

export const TABLE_LABELS: Record<string, string> = {
  guns: "Guns",
  gun_classes: "Gun classes",
  gun_tree_branches: "Tree branches",
  accolade_definitions: "Accolades",
  accolade_rules: "Accolade rules",
  score_formula: "Scoring formula",
  score_formula_config: "Scoring weights",
  scoring_eras: "Scoring eras",
  teams: "Teams",
  elo_config: "ELO config",
  elo_tiers: "ELO tiers",
  xp_config: "XP config",
  rank_levels: "Rank levels",
  rating_config: "Rating config",
  rating_brackets: "Rating brackets",
  seasons: "Seasons",
  challenges: "Challenges",
  spawn_camp_config: "Spawn-camp config",
  streak_definitions: "Streaks",
  streak_rules: "Streak rules",
  excluded_players: "Excluded players",
};

export const tableLabel = (t: string): string => TABLE_LABELS[t] ?? t;

export const actionVerb = (a: string): string =>
  a === "INSERT" ? "created" : a === "DELETE" ? "deleted" : "updated";

/** Best-effort human name for the affected row. */
export function targetName(entry: AuditEntry): string | null {
  const d = entry.new_data ?? entry.old_data;
  if (!d) return null;
  for (const k of ["name", "nickname", "label", "challenge_name", "key"]) {
    const v = d[k];
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return null;
}
