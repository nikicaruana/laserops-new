/* eslint-disable */
/**
 * scripts/import-backlog-finances.ts
 * --------------------------------------------------------------------
 * One-off: backfill historical incomings from the finance sheet into the ledger.
 * Reads the duplicate-checked plan (scratchpad/import-plan.json). Creates the old
 * game containers (LO-WR-25-NN) and inserts Game Fees + Drinks financial_entries
 * for every game that doesn't already carry finances. Idempotent per match_code
 * for creation; financial inserts are guarded by a per-(match, category, note)
 * existence check so a re-run never duplicates.
 *
 *   npx tsx scripts/import-backlog-finances.ts            # DRY RUN
 *   npx tsx scripts/import-backlog-finances.ts --live      # write
 */
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const LIVE = process.argv.includes("--live");
const OPERATOR_ID = "00000000-0000-0000-0000-000000000001";
const SP = "C:/Users/nikic/AppData/Local/Temp/claude/C--Users-nikic-Documents-Laseropsmalta-com-laserops-new--claude-worktrees-beautiful-bouman-66c3b3/f0f41fbf-4edc-4679-b4aa-7e0e88372652/scratchpad";
const NOTE_TAG = "[sheet-backfill]"; // marker so a re-run can detect its own rows

function env() { const e: Record<string, string> = {}; for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) e[m[1]] = m[2].replace(/^["']|["']$/g, ""); } return e; }
const title = (g: any) => { const nm = g.name && g.name !== "Open Game" && g.name !== "/" ? ` - ${g.name}` : ""; return `${g.type}${nm} - ${g.date}`; };

async function main() {
  const e = env();
  const svc = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const plan = JSON.parse(readFileSync(`${SP}/import-plan.json`, "utf8")) as any[];
  // LO-2025-03 was flagged AUG_INCOMPLETE; the user asked to fill it -> treat as ADD_FIN.
  for (const p of plan) if (p.action === "AUG_INCOMPLETE") p.action = "ADD_FIN";

  const todo = plan.filter((p) => p.action === "CREATE_ADD" || p.action === "ADD_FIN");
  const { data: existingMatches } = await svc.from("matches").select("id, match_code");
  const codeToId = new Map((existingMatches ?? []).map((m: any) => [m.match_code, m.id]));

  let created = 0, feRows = 0, gTot = 0, dTot = 0, skippedDup = 0;
  const now = new Date().toISOString();

  for (const p of todo) {
    let matchId: string | undefined = p.container ? codeToId.get(p.container) : codeToId.get(p.code);

    if (p.action === "CREATE_ADD") {
      if (codeToId.has(p.code)) { matchId = codeToId.get(p.code); } // already created on a prior run
      else {
        const yr = Number(p.date.slice(0, 4));
        const idx = Number((p.code.match(/(\d+)$/) || [])[1] || 0);
        const row = {
          operator_id: OPERATOR_ID, match_code: p.code, year: yr, sequence_no: 900 + idx,
          played_on: p.date, scheduled_at: `${p.date}T${(p.start || "18:00")}:00+02:00`,
          is_private: /company|team|birthday|kids|bachelor|private/i.test(p.type), is_double_xp: false, teams_stable: true,
          status: "completed", title: title(p), min_players: 10, registered_count: 0, paid_count: 0, on_day_count: 0,
          pricing_mode: "flat", invite_code: randomBytes(4).toString("hex"), calendar_sequence: 0,
          live_feed_enabled: false, scoring_mode: "offline", mode_slug: "domination", duration_minutes: 180, is_beginner: false,
        };
        console.log(`  CREATE ${p.code.padEnd(12)} ${p.date}  "${row.title}"`);
        if (LIVE) {
          const { data, error } = await svc.from("matches").insert(row).select("id").single();
          if (error) { console.error(`  match insert failed (${p.code}): ${error.message}`); process.exit(1); }
          matchId = (data as any).id; codeToId.set(p.code, matchId!);
        }
        created++;
      }
    }

    if (!matchId && !LIVE) matchId = "(dry)"; // placeholder in dry run
    if (!matchId) { console.error(`  no container for ${p.code}`); process.exit(1); }

    const entries: { category: string; amount: number }[] = [];
    if (p.game > 0) entries.push({ category: "game", amount: p.game });
    if (p.drinks > 0) entries.push({ category: "drinks", amount: p.drinks });
    for (const en of entries) {
      const note = `${en.category === "game" ? "Game fees" : "Drinks"} ${NOTE_TAG} ${p.code}${en.category === "game" ? ` · ${p.players} players` : ""}`;
      // dup guard
      if (LIVE && matchId !== "(dry)") {
        const { data: dup } = await svc.from("financial_entries").select("id").eq("match_id", matchId).eq("category", en.category).ilike("note", `%${NOTE_TAG} ${p.code}%`).limit(1);
        if (dup && dup.length) { skippedDup++; continue; }
      }
      feRows++; if (en.category === "game") gTot += en.amount; else dTot += en.amount;
      if (LIVE && matchId !== "(dry)") {
        const { error } = await svc.from("financial_entries").insert({
          occurred_at: `${p.date}T12:00:00+02:00`, direction: "payment",
          category: en.category, amount_eur: en.amount, method: p.method, account_id: null, match_id: matchId,
          source: "manual", note,
        });
        if (error) { console.error(`  fin insert failed (${p.code}/${en.category}): ${error.message}`); process.exit(1); }
      }
    }
  }

  console.log(`\n${LIVE ? "WROTE" : "DRY RUN"} — containers created: ${created}, financial rows: ${feRows} (skipped dup: ${skippedDup})`);
  console.log(`  game €${gTot.toFixed(2)} + drinks €${dTot.toFixed(2)} = €${(gTot + dTot).toFixed(2)}`);
  if (!LIVE) console.log("  (dry run — nothing written. Re-run with --live.)");
}
main().catch((e) => { console.error(e); process.exit(1); });
