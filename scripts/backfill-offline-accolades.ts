/**
 * scripts/backfill-offline-accolades.ts  (one-off)
 * Recomputes the 14 stat-based accolades for offline matches that have no awards,
 * from the stored match_player_aggregate rows, writes match_awards + sets each
 * winner's xp_from_accolades, then recomputes XP/level/Elo + rebuilds read-models.
 *   npx tsx scripts/backfill-offline-accolades.ts
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { computeAccolades, type AccoladeStat } from "../lib/ingestion/accolades";
import { recomputeProgression } from "../lib/ingestion/progression";

function env() {
  const e: Record<string, string> = {};
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) e[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
  return e;
}
const normKey = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
const OFFLINE_EXCLUDE = new Set(["CAP-Tain", "Fortress"]);

async function main() {
  const e = env();
  const svc = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const anon = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

  // accolade name -> { id, xp } (anon can read accolade_definitions).
  const { data: defs, error: de } = await anon.from("accolade_definitions").select("id, name, xp");
  if (de) throw new Error("defs read: " + de.message);
  const byKey = new Map<string, { id: string; xp: number }>();
  for (const d of defs as { id: string; name: string; xp: number }[]) byKey.set(normKey(d.name), { id: d.id, xp: Number(d.xp) || 0 });

  // Completed matches with NO existing awards.
  const { data: completed } = await svc.from("matches").select("id, match_code").eq("status", "completed");
  const { data: awRows } = await svc.from("match_awards").select("match_id");
  const withAwards = new Set((awRows ?? []).map((a) => a.match_id as string));
  const targets = (completed ?? []).filter((m) => !withAwards.has(m.id as string));
  console.log(`matches to backfill: ${targets.length}`);

  let totalAwards = 0;
  for (const m of targets) {
    const { data: aggs } = await svc
      .from("match_player_aggregate")
      .select("id, account_id, nickname, headset_label, team_colour, score, frags, deaths, kd, shots, hits, accuracy, wounds, damage")
      .eq("match_id", m.id);
    if (!aggs || aggs.length === 0) { console.log(`  ${m.match_code}: no aggregates, skip`); continue; }

    const stats: AccoladeStat[] = aggs.map((a, i) => ({
      id: i,
      name: (a.nickname as string) || (a.headset_label as string) || String(i),
      team: (a.team_colour as string) ?? "",
      score: Number(a.score) || 0, frags: Number(a.frags) || 0, deaths: Number(a.deaths) || 0,
      kd: Number(a.kd) || 0, shots: Number(a.shots) || 0, hits: Number(a.hits) || 0,
      accuracy: Number(a.accuracy) || 0, wounds: Number(a.wounds) || 0, damage: Number(a.damage) || 0,
      captures: 0, holdSeconds: 0,
    }));

    const xpByAggId = new Map<string, number>();
    const awards = computeAccolades(stats)
      .filter((w) => !OFFLINE_EXCLUDE.has(w.name))
      .map((w) => {
        const def = byKey.get(normKey(w.name));
        if (!def) return null;
        const a = aggs[w.winnerId];
        xpByAggId.set(a.id as string, (xpByAggId.get(a.id as string) ?? 0) + def.xp);
        return { match_id: m.id, account_id: a.account_id, headset_label: a.headset_label, nickname: a.nickname, accolade_definition_id: def.id, xp_granted: def.xp, awarded_at: new Date().toISOString() };
      })
      .filter(Boolean) as Record<string, unknown>[];

    // idempotent: clear this match's awards, then insert fresh.
    await svc.from("match_awards").delete().eq("match_id", m.id);
    if (awards.length) {
      const { error: ie } = await svc.from("match_awards").insert(awards);
      if (ie) { console.log(`  ${m.match_code}: award insert ERR ${ie.message}`); continue; }
    }
    // set xp_from_accolades per winner; others stay 0 (reset first for safety).
    await svc.from("match_player_aggregate").update({ xp_from_accolades: 0 }).eq("match_id", m.id);
    for (const [aggId, xp] of xpByAggId) {
      await svc.from("match_player_aggregate").update({ xp_from_accolades: xp }).eq("id", aggId);
    }
    totalAwards += awards.length;
    console.log(`  ${m.match_code}: ${awards.length} accolades`);
  }

  console.log(`\nInserted ${totalAwards} awards across ${targets.length} matches. Recomputing progression...`);
  const stats = await recomputeProgression(svc as never);
  console.log("recomputeProgression:", JSON.stringify(stats));
  const { error: re } = await svc.rpc("rollup_match_careers");
  console.log("rollup_match_careers:", re ? "ERR " + re.message : "ok");
}
main().catch((e) => { console.error(e); process.exit(1); });
