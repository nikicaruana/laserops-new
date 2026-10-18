/* eslint-disable */
/**
 * scripts/accolade-rounds-gate-impact.ts  (READ-ONLY)
 * --------------------------------------------------------------------
 * Shows which online games' Ghost / Ammo Saver / Pacifist / Tank accolade would
 * change winner under the new full-attendance gate (recomputed from the stored
 * match_player_aggregate - accolades are a pure function of those stats). Lists
 * old winner (rounds played) -> new winner, so we know exactly what to re-score.
 *   npx tsx scripts/accolade-rounds-gate-impact.ts
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { computeAccolades, type AccoladeStat } from "../lib/ingestion/accolades";

function env() {
  const e: Record<string, string> = {};
  for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) e[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
  return e;
}
const GATED = ["Ghost", "Ammo Saver", "Pacifist", "Tank"];

async function main() {
  const e = env();
  const svc = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const anon = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data: defs } = await anon.from("accolade_definitions").select("id, name").eq("scope", "match");
  const nameById = new Map((defs ?? []).map((d: any) => [d.id as string, d.name as string]));

  // Online games = at least one online round.
  const { data: matches } = await svc.from("matches")
    .select("id, match_code, played_on, online_round_count")
    .gt("online_round_count", 0).not("xp_distributed_at", "is", null)
    .order("played_on");
  console.log(`Scanning ${(matches ?? []).length} online games...\n`);

  const affected: string[] = [];
  for (const m of (matches ?? []) as any[]) {
    const { data: agg } = await svc.from("match_player_aggregate")
      .select("nickname, team_colour, score, frags, deaths, kd, shots, hits, accuracy, wounds, damage, captures, hold_seconds, rounds_played")
      .eq("match_id", m.id);
    if (!agg || agg.length === 0) continue;
    const rpByNick = new Map((agg as any[]).map((a) => [a.nickname, a.rounds_played]));
    const stats: AccoladeStat[] = (agg as any[]).map((a, i) => ({
      id: i, name: a.nickname, team: a.team_colour, score: a.score, frags: a.frags, deaths: a.deaths, kd: Number(a.kd),
      shots: a.shots, hits: a.hits, accuracy: Number(a.accuracy), wounds: a.wounds, damage: a.damage,
      captures: a.captures, holdSeconds: a.hold_seconds, roundsPlayed: a.rounds_played,
    }));
    const maxR = Math.max(...stats.map((s) => s.roundsPlayed ?? 0));
    const newWins = new Map(computeAccolades(stats).map((w) => [w.name, w.winnerName]));

    // Current winners of the 4 gated accolades from match_awards.
    const { data: awards } = await svc.from("match_awards").select("headset_label, accolade_definition_id").eq("match_id", m.id);
    const curByAcc = new Map<string, string>();
    for (const aw of (awards ?? []) as any[]) { const nm = nameById.get(aw.accolade_definition_id); if (nm && GATED.includes(nm)) curByAcc.set(nm, aw.headset_label); }

    const changes: string[] = [];
    for (const acc of GATED) {
      const cur = curByAcc.get(acc);
      const neu = newWins.get(acc);
      if (cur && neu && cur !== neu) {
        const curR = rpByNick.get(cur), newR = rpByNick.get(neu);
        changes.push(`${acc}: ${cur}(${curR}r) -> ${neu}(${newR}r)`);
      }
    }
    if (changes.length) { affected.push(m.match_code); console.log(`${m.match_code} [${m.played_on}] maxRounds=${maxR}\n    ${changes.join("\n    ")}`); }
  }
  console.log(`\n${affected.length} game(s) affected: ${affected.join(", ") || "(none)"}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
