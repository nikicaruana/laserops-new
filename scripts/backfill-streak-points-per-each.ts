/* eslint-disable */
/**
 * scripts/backfill-streak-points-per-each.ts
 * --------------------------------------------------------------------
 * One-time fix for the streak-points display double-count. Historically the
 * match_player_aggregate.streaks JSON stored each streak's `points` as a TOTAL
 * (base * count); the report tile then multiplied by count again, inflating the
 * label (e.g. 5 Piece x8 showed 3200 instead of 400). build.ts now stores the
 * per-each base. This rewrites the stored JSON on already-published games so the
 * per-each contract holds everywhere.
 *
 * DISPLAY-ONLY: only the streaks[].points field is rewritten. Scores, XP, ELO,
 * counts and keys are untouched. Idempotent and self-guarding per streak:
 *   - points === base * count  -> convert to base (the fix)
 *   - points === base          -> already per-each, leave as-is
 *   - anything else            -> leave as-is and warn (never guess)
 * where base is the live streak_definitions.points for that key.
 *
 *   npx tsx scripts/backfill-streak-points-per-each.ts          # dry run
 *   npx tsx scripts/backfill-streak-points-per-each.ts --apply  # write
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { STREAK_POINTS } from "../lib/match-report-v2/build";

function env() {
  const e: Record<string, string> = {};
  for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) e[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return e;
}

type Streak = { key: string; count: number; points: number };

const APPLY = process.argv.includes("--apply");

(async () => {
  const E = env();
  const db = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // base points per key = live admin config, falling back to the code defaults.
  const base = new Map<string, number>(Object.entries(STREAK_POINTS));
  const { data: defs } = await db.from("streak_definitions").select("streak_key, points");
  for (const d of (defs ?? []) as { streak_key: string; points: number }[]) base.set(d.streak_key, d.points);

  const { data: rows, error } = await db
    .from("match_player_aggregate")
    .select("id, match_id, streaks")
    .not("streaks", "is", null);
  if (error) throw error;

  let rowsChanged = 0;
  let streaksConverted = 0;
  let streaksAlready = 0;
  const warnings: string[] = [];

  for (const r of (rows ?? []) as { id: string; match_id: string; streaks: Streak[] }[]) {
    if (!Array.isArray(r.streaks) || r.streaks.length === 0) continue;
    let rowChanged = false;
    const next = r.streaks.map((s) => {
      const b = base.get(s.key);
      const count = Number(s.count) || 0;
      const pts = Number(s.points) || 0;
      if (b == null || count <= 0) {
        warnings.push(`row ${r.id}: ${s.key} count=${s.count} points=${s.points} (no base / bad count) - left as-is`);
        return s;
      }
      if (pts === b) {
        streaksAlready++;
        return s; // already per-each
      }
      if (pts === b * count) {
        streaksConverted++;
        rowChanged = true;
        return { ...s, points: b }; // total -> per-each
      }
      warnings.push(`row ${r.id}: ${s.key} count=${count} points=${pts} base=${b} (unexpected) - left as-is`);
      return s;
    });
    if (rowChanged) {
      rowsChanged++;
      if (APPLY) {
        const { error: upErr } = await db.from("match_player_aggregate").update({ streaks: next }).eq("id", r.id);
        if (upErr) warnings.push(`row ${r.id}: update failed: ${upErr.message}`);
      }
    }
  }

  console.log(APPLY ? "=== APPLIED ===" : "=== DRY RUN (pass --apply to write) ===");
  console.log(`rows scanned:        ${rows?.length ?? 0}`);
  console.log(`rows ${APPLY ? "updated" : "to update"}:    ${rowsChanged}`);
  console.log(`streaks converted:   ${streaksConverted} (total -> per-each)`);
  console.log(`streaks already ok:  ${streaksAlready}`);
  if (warnings.length) {
    console.log(`\nwarnings (${warnings.length}):`);
    for (const w of warnings.slice(0, 40)) console.log("  " + w);
    if (warnings.length > 40) console.log(`  ... and ${warnings.length - 40} more`);
  }
})().then(() => process.exit(0)).catch((e) => { console.error(e.message || e); process.exit(1); });
