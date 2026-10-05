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
  base_trading_config: "Base-trading config",
  streak_definitions: "Streaks",
  streak_rules: "Streak rules",
  excluded_players: "Excluded players",
  pricing_config: "Pricing",
  refund_config: "Refund config",
  token_config: "Token config",
  token_bundles: "Token bundles",
  reward_images: "Reward images",
  email_config: "Email settings",
  notification_types: "Notification type",
  locations: "Location",
  killstreak_definitions: "Killstreaks",
  level_unlocks: "Level rewards",
  home_config: "Homepage",
  home_social_posts: "Homepage social post",
  home_reviews: "Homepage review",
  home_featured_photos: "Homepage featured photo",
  accounts: "Player fixed price",
};

export const tableLabel = (t: string): string => TABLE_LABELS[t] ?? t;

export const actionVerb = (a: string): string =>
  a === "INSERT" ? "created" : a === "DELETE" ? "deleted" : "updated";

/** Fields that are noise in a change log (identity / timestamps). */
const IGNORE_FIELDS = new Set(["id", "operator_id", "created_at", "updated_at", "created_by", "updated_by"]);

export type FieldChange = { field: string; from: unknown; to: unknown };

/** The fields that actually changed between old_data and new_data (before → after). */
export function changedFields(entry: AuditEntry): FieldChange[] {
  const oldD = (entry.old_data ?? {}) as Record<string, unknown>;
  const newD = (entry.new_data ?? {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(oldD), ...Object.keys(newD)]);
  const out: FieldChange[] = [];
  for (const k of keys) {
    if (IGNORE_FIELDS.has(k)) continue;
    if (JSON.stringify(oldD[k]) !== JSON.stringify(newD[k])) out.push({ field: k, from: oldD[k], to: newD[k] });
  }
  return out;
}

/** Human label for a snake_case field name. */
export const fieldLabel = (f: string): string =>
  f.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Compact display of a value (truncates large objects). */
export function fmtVal(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "on" : "off";
  if (typeof v === "object") {
    const s = JSON.stringify(v);
    return s.length > 80 ? s.slice(0, 77) + "…" : s;
  }
  return String(v);
}

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
