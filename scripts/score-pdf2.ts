/**
 * scripts/score-pdf2.ts — Match Scorecard PDF template.
 * --------------------------------------------------------------------
 * Reusable per-batch scorecard generator. For the next batch, drop the round
 * files (r1.json, r2.json, …) into a folder and run:
 *
 *   npx tsx scripts/score-pdf2.ts <dataDir> <matchLabel>
 *   e.g. npx tsx scripts/score-pdf2.ts sample-game-data LO-2026-27
 *
 * It globs r*.json in <dataDir>, aggregates across rounds, and writes
 * <dataDir>/LaserOps-Match-<matchLabel>-scores.pdf. Rows are keyed by headband;
 * optionally fill NAMES (headband -> player name) or HB_EMAIL to label rows.
 * Scoring knobs: MIN_HOLD (sub-5s capture exclusion), spawn windows 3/4/5s,
 * objective scenarios A–D, streak points (from seed_streaks.sql). Accolades are
 * XP-only and deliberately excluded.
 */
import { readFileSync, createWriteStream, readdirSync } from "node:fs";
import PDFDocument from "pdfkit";
import { parseRound, type Round } from "../lib/ingestion/round-parser";
import { detectStreaks } from "../lib/ingestion/streaks";
const DATA_DIR = process.argv[2] || "sample-game-data";
const MATCH_LABEL = process.argv[3] || "LO-2026-27";
const MIN_HOLD = 5, RECAP_WINDOW = 20;
// Default streak points (supabase/migrations/20260731350000_seed_streaks.sql).
const STREAK_POINTS: Record<string, number> = {
  kill_streak_3: 25, kill_streak_5: 50, kill_streak_10: 100, kill_streak_20: 200,
  survivor: 50, first_blood: 25, last_blood: 25, clutch_move: 50, ptfo: 50, map_domination: 100,
  clean_sweep: 50, grim_reaper: 100, streak_ender: 50, hold_base_3min: 50, hold_base_5min: 100, hold_base_10min: 200,
  captures_3: 25, captures_5: 50, captures_10: 100, burner_1: 50, burner_2: 100, bully: 100, shadow: 100,
};
const HB_EMAIL: Record<string, string> = {
  "01": "simon@drinklinkevents.com", "02": "michelezahra@gmail.com", "04": "sina.salminen@gmail.com",
  "06": "jensbud@gmail.com", "37": "bsodgaming1@gmail.com", "39": "andrewct214@gmail.com", "40": "wiggman@gmail.com",
  "41": "glenngatt10289@gmail.com", "42": "tomas.calmfors@gmail.com", "45": "axel.lundberg1@gmail.com",
};
const NAMES: Record<string, string> = {}; // fill headband -> name when provided (takes priority over email)
const roundFiles = readdirSync(DATA_DIR).filter((f) => /^r\d+\.json$/i.test(f)).sort((a, b) => (parseInt(a.slice(1)) - parseInt(b.slice(1))));
if (roundFiles.length === 0) { console.error(`No r*.json round files found in ${DATA_DIR}`); process.exit(1); }
console.log(`Reading ${roundFiles.length} rounds from ${DATA_DIR}: ${roundFiles.join(", ")}`);
function ep(t: string) { const m = t.match(/(\d+)\.(\d+)\.(\d+) (\d+):(\d+):(\d+)/); if (!m) return NaN; return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000; }
function hb(name: string) { const m = name.match(/head\s*0*(\d+)/i); return m ? String(+m[1]).padStart(2, "0") : name; }
type W = 3 | 4 | 5;
type Agg = { hbNo: string; frags: number; damage: number; hits: number; shots: number; deaths: number;
  sk: Record<W, number>; sd: Record<W, number>; capN: number; recapN: number; excl: number; hold: number;
  streak: number; streakBreak: Record<string, number> };
const agg: Record<string, Agg> = {};
const A = (nm: string) => agg[nm] ??= (agg[nm] = { hbNo: hb(nm), frags: 0, damage: 0, hits: 0, shots: 0, deaths: 0,
  sk: { 3: 0, 4: 0, 5: 0 }, sd: { 3: 0, 4: 0, 5: 0 }, capN: 0, recapN: 0, excl: 0, hold: 0, streak: 0, streakBreak: {} });

for (const file of roundFiles) {
  const text = readFileSync(`${DATA_DIR}/${file}`, "utf8");
  const r: Round = parseRound(text, { spawnWindowSeconds: 3 });
  const name: Record<number, string> = {}; for (const p of r.players) name[p.in_game_player_id] = p.name;
  const maxHp = r.meta.max_hp;
  // Death-anchored respawns: first HP==maxHp frame at/after each Deaths increment.
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const evs: { pid: number; ep: number; hp?: number; deaths?: number }[] = [];
  for (const l of lines) { let o: any; try { o = JSON.parse(l); } catch { continue; } if (o.ItemType !== "PlayerEvent") continue;
    const it = o.Item || {}; evs.push({ pid: it.PlayerId, ep: ep(o.EventTime), hp: it.HP, deaths: it.Deaths }); }
  const byP: Record<number, typeof evs> = {}; for (const e of evs) (byP[e.pid] ??= []).push(e);
  const respawns: Record<number, number[]> = {};
  for (const pid of Object.keys(byP).map(Number)) {
    const arr = byP[pid].sort((a, b) => a.ep - b.ep); let prevDeaths = 0, awaiting = false; const list: number[] = [];
    for (const e of arr) {
      if (e.deaths != null && e.deaths > prevDeaths) { awaiting = true; prevDeaths = e.deaths; }
      if (awaiting && e.hp === maxHp) { list.push(e.ep); awaiting = false; }
    }
    respawns[pid] = list;
  }
  const lastRes = (v: number, t: number) => { const a = respawns[v] || []; let b: number | null = null; for (const x of a) { if (x <= t) b = x; else break; } return b; };
  for (const p of r.players) { const c = r.final_player_counters[p.in_game_player_id]; if (!c) continue; const a = A(p.name);
    a.frags += c.frags; a.damage += (r.damage_dealt[p.in_game_player_id] || 0); a.hits += c.hits; a.shots += c.shots; a.deaths += c.deaths; }
  for (const k of r.events.kills) { const t = ep(k.time); const rs = lastRes(k.victim_id, t); if (rs == null) continue; const d = t - rs; const a = A(name[k.actor_id]);
    for (const w of [3, 4, 5] as W[]) if (d <= w) a.sk[w]++; }
  for (const dm of r.events.damage) { if (dm.damage <= 0) continue; const t = ep(dm.time); const rs = lastRes(dm.victim_id, t); if (rs == null) continue; const d = t - rs; const a = A(name[dm.actor_id]);
    for (const w of [3, 4, 5] as W[]) if (d <= w) a.sd[w] += dm.damage; }
  const periodOf = (b: number, f: string) => r.base_ownership.find((p) => p.base_id === b && p.from_time === f);
  const burnEp: Record<number, number> = {}; for (const b of r.result.burns) burnEp[b.base_id] = b.burn_epoch;
  const valid: { pid: number; base: number; t: number; held: number }[] = [];
  for (const cap of r.events.captures) { if (cap.capturing_player_id == null || cap.base_id < 0) continue;
    const per = periodOf(cap.base_id, cap.time); const held = per ? per.held_seconds : 0; const ct = ep(cap.time);
    const toT = per && per.to_time ? ep(per.to_time) : ct + held;
    const burnIn = burnEp[cap.base_id] != null && burnEp[cap.base_id] >= ct - 1 && burnEp[cap.base_id] <= toT + 1;
    if (held < MIN_HOLD && !burnIn) { A(name[cap.capturing_player_id]).excl++; continue; }
    valid.push({ pid: cap.capturing_player_id, base: cap.base_id, t: ct, held }); }
  const last: Record<string, number> = {}; valid.sort((a, b) => a.t - b.t);
  for (const v of valid) { const a = A(name[v.pid]); a.hold += v.held; const k = `${v.pid}:${v.base}`;
    if (last[k] != null && v.t - last[k] <= RECAP_WINDOW) a.recapN++; else a.capN++; last[k] = v.t; }
  // Streaks — count toward score. Capture-based streaks must respect the <5s
  // exclusion, so feed detectStreaks a round whose captures drop sub-5s non-burn
  // ones (kill/hold/burn streaks are unaffected by that filter).
  const excludedKey = new Set<string>();
  for (const cap of r.events.captures) {
    if (cap.capturing_player_id == null || cap.base_id < 0) continue;
    const per = periodOf(cap.base_id, cap.time); const held = per ? per.held_seconds : 0; const ct = ep(cap.time);
    const toT = per && per.to_time ? ep(per.to_time) : ct + held;
    const burnIn = burnEp[cap.base_id] != null && burnEp[cap.base_id] >= ct - 1 && burnEp[cap.base_id] <= toT + 1;
    if (held < MIN_HOLD && !burnIn) excludedKey.add(`${cap.capturing_player_id}:${cap.base_id}:${cap.time}`);
  }
  const filteredCaptures = r.events.captures.filter((c) =>
    !(c.capturing_player_id != null && c.base_id >= 0 && excludedKey.has(`${c.capturing_player_id}:${c.base_id}:${c.time}`)));
  const rStreak: Round = { ...r, events: { ...r.events, captures: filteredCaptures } };
  for (const aw of detectStreaks(rStreak)) {
    const pts = STREAK_POINTS[aw.key] ?? 0; if (!pts) continue;
    const a = A(name[aw.player_id]); a.streak += pts; a.streakBreak[aw.key] = (a.streakBreak[aw.key] ?? 0) + 1;
  }
}
function killScore(a: Agg, w: W) { const f = Math.max(0, a.frags - a.sk[w]); const dmg = Math.max(0, a.damage - a.sd[w]);
  const acc = a.shots > 0 ? a.hits / a.shots : 0; const kd = a.deaths > 0 ? f / a.deaths : f;
  return Math.round((f * 50 + dmg * 0.2) * (1 + acc * 0.2) * (1 + kd * 0.12)); }
const OBJ = (a: Agg, cap: number, rc: number, h: number) => a.capN * cap + a.recapN * rc + a.hold * h;
const rows = Object.values(agg).map((a) => { const k3 = killScore(a, 3), B = OBJ(a, 75, 50, 2);
  return { a, k3, k4: killScore(a, 4), k5: killScore(a, 5),
    A: OBJ(a, 200, 180, 2), B, C: OBJ(a, 75, 50, 3), D: OBJ(a, 50, 30, 2), total: k3 + B + a.streak }; });
rows.sort((x, y) => y.total - x.total);

console.log("HB  frags sk3/4/5   dmg   sd3/4/5        caps(+rc)[<5s] hold  K@3  K@4  K@5   A    B    C    D    Strk  TOT");
for (const r of rows) { const a = r.a;
  console.log(`${a.hbNo}  ${String(a.frags).padStart(3)}  ${a.sk[3]}/${a.sk[4]}/${a.sk[5]}  ${String(a.damage).padStart(5)} ${a.sd[3]}/${a.sd[4]}/${a.sd[5]}  ${a.capN}(+${a.recapN})[${a.excl}]  ${String(a.hold).padStart(4)}  ${r.k3} ${r.k4} ${r.k5}   ${r.A} ${r.B} ${r.C} ${r.D}   ${a.streak}  ${r.total}`); }
console.log("\nStreak breakdown (streaks that fired, ×count):");
for (const r of rows) { const b = r.a.streakBreak;
  console.log(`${r.a.hbNo}: ${Object.entries(b).map(([k, n]) => `${k}×${n}`).join(", ") || "—"}`); }

const doc = new PDFDocument({ size: "A3", layout: "landscape", margin: 36 });
const out = `${DATA_DIR}/LaserOps-Match-${MATCH_LABEL}-scores.pdf`;
doc.pipe(createWriteStream(out));
doc.fillColor("#111").fontSize(18).font("Helvetica-Bold").text(`LaserOps — Match ${MATCH_LABEL} · Scoring Scenarios`);
doc.moveDown(0.2).fontSize(9).font("Helvetica").fillColor("#444");
doc.text("Score = Kill Score + Objective + Streaks. Objective columns (A–D) show OBJECTIVE points only (base captures + hold). Streaks count toward score and have their own column. Accolades are XP-only and are NOT included here. TOTAL uses Kill@3s + Objective B + Streaks.");
doc.moveDown(0.3);
doc.font("Helvetica-Bold").fillColor("#111").text("Kill Score", { continued: true }).font("Helvetica").fillColor("#444")
  .text(" = round( (Kills×50 + Damage×0.2) × (1 + Accuracy×0.2) × (1 + K/D×0.12) ). Spawn-trap kills & damage are VOIDED before scoring. Three columns vary the spawn-protection window: @3s / @4s / @5s (wider window = more voided = lower score).");
doc.moveDown(0.2);
doc.font("Helvetica-Bold").fillColor("#111").text("Streaks", { continued: true }).font("Helvetica").fillColor("#444")
  .text(" = sum of streak points (3/5/10-streak 25/50/100, first/last blood 25, survivor 50, clutch 50, PTFO 50, map dom 100, clean sweep 50, grim reaper 100, streak ender 50, hold 3/5/10min 50/100/200, cap 3/5/10 25/50/100, burner 50/100, bully 100, shadow 100). Captures held <5s are excluded from capture-based streaks too.");
doc.moveDown(0.3);
const legend: [string, string][] = [
  ["A", "Capture ×200 · Recapture ×180 · Hold ×2/s  (current live model)"],
  ["B", "Capture ×75 · Recapture ×50 · Hold ×2/s  (chosen)"],
  ["C", "Capture ×75 · Recapture ×50 · Hold ×3/s"],
  ["D", "Capture ×50 · Recapture ×30 · Hold ×2/s"]];
doc.font("Helvetica-Bold").fillColor("#111").text("Objective scenarios: ");
for (const [k, v] of legend) { doc.font("Helvetica-Bold").fillColor("#111").text(k + "  ", { continued: true }).font("Helvetica").fillColor("#444").text(v); }
doc.moveDown(0.5);
const cols: [string, number][] = [["Player", 175], ["Kills (spawn 3s/4s/5s)", 112], ["Damage (spawn 3s/4s/5s)", 132],
  ["Caps ct (+recap) [<5s excl]", 122], ["Hold s", 46], ["Kill@3s", 54], ["Kill@4s", 54], ["Kill@5s", 54],
  ["A obj", 52], ["B obj", 52], ["C obj", 52], ["D obj", 52], ["Streaks", 52], ["TOTAL (K@3s+B+Strk)", 86]];
const x0 = 36; let y = doc.y; const totalW = cols.reduce((s, c) => s + c[1], 0);
function row(cells: string[], bold: boolean, fill?: string) {
  const h = 17; if (fill) { doc.rect(x0, y - 2, totalW, h).fill(fill); }
  let x = x0; doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 8 : 9).fillColor("#111");
  cells.forEach((c, i) => { const w = cols[i][1]; doc.text(c, x + 3, y + 2, { width: w - 6, align: i === 0 ? "left" : "right", lineBreak: false }); x += w; });
  y += h;
}
row(cols.map((c) => c[0]), true, "#f0e14a");
rows.forEach((r, idx) => { const a = r.a; const nm = NAMES[a.hbNo] || HB_EMAIL[a.hbNo] || `Head ${a.hbNo}`;
  row([`${nm}  (HB ${a.hbNo})`, `${a.frags} (${a.sk[3]}/${a.sk[4]}/${a.sk[5]})`, `${a.damage} (${a.sd[3]}/${a.sd[4]}/${a.sd[5]})`,
    `${a.capN} (+${a.recapN}) [${a.excl}]`, String(a.hold), String(r.k3), String(r.k4), String(r.k5),
    String(r.A), String(r.B), String(r.C), String(r.D), String(a.streak), String(r.total)], false, idx % 2 ? "#f7f7f7" : undefined); });
doc.moveDown(1).fontSize(8).fillColor("#888").text("Kills bracket = kills counted as spawn trapping at each window. Damage bracket = damage dealt in spawn-trap hits at each window (voided in Kill@Ns). Caps: counted captures (+ same-player recaptures) [captures held <5s, excluded]. Names pending — keyed by email/headband.", 36, y + 8);
doc.end();
setTimeout(() => console.log("\nwrote " + out), 400);
