/**
 * scripts/backfill-specialist.ts  (one-off)
 * Adds the Specialist accolade (top scorer per gun) to every completed match
 * from the stored aggregates, then recomputes each aggregate's xp_from_accolades
 * as the sum of ALL its awards (idempotent), and recomputes XP/level/Elo.
 *   npx tsx scripts/backfill-specialist.ts
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { specialistWinners } from "../lib/ingestion/accolades";
import { recomputeProgression } from "../lib/ingestion/progression";

function env() {
  const e: Record<string, string> = {};
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) e[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
  return e;
}
const normKey = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");

async function main() {
  const e = env();
  const svc = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const anon = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

  const { data: defs, error: de } = await anon.from("accolade_definitions").select("id, name, xp");
  if (de) throw new Error("defs: " + de.message);
  const spec = (defs as { id: string; name: string; xp: number }[]).find((d) => normKey(d.name) === "specialist");
  if (!spec) throw new Error("Specialist definition not found");
  console.log("Specialist def:", spec.id, spec.xp + "xp");

  const { data: matches } = await svc.from("matches").select("id, match_code").eq("status", "completed");
  let added = 0;
  for (const m of matches ?? []) {
    const { data: aggs } = await svc
      .from("match_player_aggregate")
      .select("id, account_id, nickname, headset_label, gun_used, score, frags")
      .eq("match_id", m.id);
    if (!aggs || aggs.length === 0) continue;

    const winners = specialistWinners(aggs.map((a, i) => ({
      id: i, gun: (a.gun_used as string | null), score: Number(a.score) || 0, frags: Number(a.frags) || 0,
      name: (a.nickname as string) || (a.headset_label as string) || String(i),
    })));

    // idempotent: clear this match's Specialist awards, reinsert.
    await svc.from("match_awards").delete().eq("match_id", m.id).eq("accolade_definition_id", spec.id);
    if (winners.length) {
      const rows = winners.map((wi) => {
        const a = aggs[wi];
        return { match_id: m.id, account_id: a.account_id, headset_label: a.headset_label, nickname: a.nickname, accolade_definition_id: spec.id, xp_granted: spec.xp, awarded_at: new Date().toISOString() };
      });
      const { error: ie } = await svc.from("match_awards").insert(rows);
      if (ie) { console.log(`  ${m.match_code}: insert ERR ${ie.message}`); continue; }
      added += rows.length;
    }
    console.log(`  ${m.match_code}: ${winners.length} specialist(s)`);
  }
  console.log(`\nAdded ${added} Specialist awards.`);

  // Recompute xp_from_accolades for EVERY aggregate = sum of its awards (idempotent).
  const { data: allAw } = await svc.from("match_awards").select("match_id, headset_label, xp_granted");
  const sum = new Map<string, number>();
  for (const a of allAw ?? []) { const k = `${a.match_id}|${a.headset_label}`; sum.set(k, (sum.get(k) ?? 0) + (Number(a.xp_granted) || 0)); }
  const { data: allAgg } = await svc.from("match_player_aggregate").select("id, match_id, headset_label, xp_from_accolades");
  let updated = 0;
  for (const a of allAgg ?? []) {
    const want = sum.get(`${a.match_id}|${a.headset_label}`) ?? 0;
    if ((Number(a.xp_from_accolades) || 0) !== want) {
      await svc.from("match_player_aggregate").update({ xp_from_accolades: want }).eq("id", a.id);
      updated++;
    }
  }
  console.log(`xp_from_accolades updated on ${updated} aggregates. Recomputing...`);

  const stats = await recomputeProgression(svc as never);
  console.log("recomputeProgression:", JSON.stringify(stats));
  const { error: re } = await svc.rpc("rollup_match_careers");
  console.log("rollup_match_careers:", re ? "ERR " + re.message : "ok");
}
main().catch((e) => { console.error(e); process.exit(1); });
