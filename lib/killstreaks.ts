/**
 * lib/killstreaks.ts
 * --------------------------------------------------------------------
 * Shared client-side loader + types for killstreaks — the streak-unlocked
 * abilities a player deploys from the live feed to jam the enemy team's feed.
 * Definitions come from the admin CMS (`killstreak_definitions`, public-read),
 * so both the LiveSim prototype and the real live feed drive off the same rows
 * (name, thumbnail, scope, duration, unlock streak, overlay text). Deploys
 * themselves travel over an ephemeral Realtime broadcast, like taunts.
 */
import { createClient } from "@/lib/supabase/client";

export type KillstreakDef = {
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  badgeUrl: string | null;
  scope: "one" | "all";
  durationSeconds: number;
  unlockStreakKey: string | null;
  overlayText: string | null; // template; {ops} + {name} placeholders
  armInstructions: string | null;
};

type Row = {
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  badge_url: string | null;
  scope: string | null;
  duration_seconds: number | null;
  unlock_streak_key: string | null;
  overlay_text: string | null;
  arm_instructions: string | null;
};

function mapRow(r: Row): KillstreakDef {
  return {
    key: r.key,
    name: r.name,
    description: r.description,
    icon: r.icon,
    badgeUrl: r.badge_url,
    scope: r.scope === "all" ? "all" : "one",
    durationSeconds: r.duration_seconds ?? 30,
    unlockStreakKey: r.unlock_streak_key,
    overlayText: r.overlay_text,
    armInstructions: r.arm_instructions,
  };
}

/** Active killstreak definitions, ordered for display. Empty on any error. */
export async function fetchKillstreaks(): Promise<KillstreakDef[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("killstreak_definitions")
      .select("key, name, description, icon, badge_url, scope, duration_seconds, unlock_streak_key, overlay_text, arm_instructions, is_active, sort_order")
      .eq("is_active", true)
      .order("sort_order")
      .order("name");
    return (data ?? []).map((r) => mapRow(r as Row));
  } catch {
    return [];
  }
}

/** The label shown over a jammed base: "{ops}'s {name}" by default. */
export function killstreakOverlayLabel(def: KillstreakDef, opsTag: string): string {
  const tpl = def.overlayText && def.overlayText.trim() ? def.overlayText : "{ops}'s {name}";
  return tpl.replace(/\{ops\}/g, opsTag).replace(/\{name\}/g, def.name);
}

// ── Live deployments (Option B: persisted so a reload can't clear a jam) ───────

export type ActiveDeployment = {
  id: string;
  roundNo: number | null;
  killstreakKey: string;
  byPlayer: string;
  byTeam: string;
  scope: "one" | "all";
  baseIds: number[];
  expiresAtMs: number;
};

type DeployRow = {
  id: string;
  round_no: number | null;
  killstreak_key: string;
  by_player: string;
  by_team: string;
  scope: string | null;
  base_ids: number[] | null;
  expires_at: string;
};

/** Map a killstreak_deployments row (from a fetch OR a Realtime payload). */
export function mapDeploymentRow(row: unknown): ActiveDeployment {
  const r = row as DeployRow;
  return {
    id: r.id,
    roundNo: r.round_no ?? null,
    killstreakKey: r.killstreak_key,
    byPlayer: r.by_player,
    byTeam: r.by_team,
    scope: r.scope === "all" ? "all" : "one",
    baseIds: r.base_ids ?? [],
    expiresAtMs: new Date(r.expires_at).getTime(),
  };
}

/** Active (unexpired) killstreak jams for a match — used on load + reconnect. */
export async function fetchActiveDeployments(matchId: string): Promise<ActiveDeployment[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("killstreak_deployments")
      .select("id, round_no, killstreak_key, by_player, by_team, scope, base_ids, expires_at")
      .eq("match_id", matchId)
      .gt("expires_at", new Date().toISOString())
      .order("started_at");
    return (data ?? []).map(mapDeploymentRow);
  } catch {
    return [];
  }
}

/**
 * Deploy a killstreak. Goes through the `deploy_killstreak` RPC, which enforces
 * identity (you can only deploy as yourself), a live match, an unused charge and
 * an anti-spam cooldown server-side — the client can't insert directly. Team,
 * round, scope and duration are derived on the server. Enemy phones pick it up
 * via Realtime and on reload.
 */
export async function deployKillstreak(input: {
  matchId: string;
  def: KillstreakDef;
  baseIds: number[];
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const { error } = await supabase.rpc("deploy_killstreak", {
      p_match_id: input.matchId,
      p_killstreak_key: input.def.key,
      p_base_ids: input.def.scope === "all" ? [] : input.baseIds,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
