/* eslint-disable */
/**
 * scripts/reingest-online-game.ts
 * --------------------------------------------------------------------
 * STAGES a backlog online game into the real pipeline so it can be published
 * (and re-published / recomputed) like any normal game. Writes the DURABLE INPUTS:
 *
 *   - match_participants : one row per person (headset_label = primary headband,
 *                          extra_headbands = merged bands, account_id, gun_used)
 *   - match_ingest_rounds: one row per round (raw JSONL, mode, winner_override,
 *                          counts_as_round, identity_overrides, note)
 *   - matches.processing_notes
 *
 * It does NOT compute/write aggregates - after staging you PUBLISH the match from
 * the admin UI (2FA), which reads these rows + resolveRoster and reproduces the
 * corrected result (validate first with scripts/validate-reingest.ts).
 *
 * Dry-run by default; --write stages (prod write - run yourself).
 *   npx tsx scripts/reingest-online-game.ts <code> <dir> [--write]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { GAMES, norm, hbNum } from "./online-backlog-config";

const CODE = process.argv[2];
const DIR = process.argv[3];
const WRITE = process.argv.includes("--write");
const OPERATOR_ID = "00000000-0000-0000-0000-000000000001";

function env() {
  const e: Record<string, string> = {};
  for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) e[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
  return e;
}

async function main() {
  const cfg = GAMES[CODE];
  if (!cfg) { console.error(`No config for ${CODE}`); process.exit(1); }
  if (!DIR || !existsSync(`${DIR}/jsons`)) { console.error(`Pass a data dir with a jsons/ folder. Got ${DIR}`); process.exit(1); }
  const matchCode = `LO-2026-${CODE}`;
  const e = env();
  const svc = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  const { data: m } = await svc.from("matches").select("id, scoring_mode, offline_round_results").eq("match_code", matchCode).maybeSingle();
  if (!m) { console.error(`${matchCode} not found`); process.exit(1); }

  const { data: accts } = await svc.from("accounts").select("id, ops_tag");
  const byOps = new Map<string, string>();
  for (const a of (accts ?? []) as any[]) if (a.ops_tag) byOps.set(norm(a.ops_tag), a.id);
  // Guns come from the live aggregate (one per person) - matches what shipped.
  const { data: live } = await svc.from("match_player_aggregate").select("nickname, gun_used").eq("match_id", m.id);
  const gunByOps: Record<string, string> = {};
  for (const a of (live ?? []) as any[]) if (a.nickname && a.gun_used) gunByOps[a.nickname] = a.gun_used;

  // ---- Build participant rows (one per ops tag; merges -> extra_headbands) ----
  const exclude = new Set(cfg.excludeHeadbands ?? []);
  const bandsByOps: Record<string, number[]> = {};
  for (const [hbStr, ops] of Object.entries(cfg.opsByHead)) {
    const hb = Number(hbStr); if (exclude.has(hb)) continue;
    (bandsByOps[ops] ??= []).push(hb);
  }
  const participants = Object.entries(bandsByOps).map(([ops, bands]) => {
    const sorted = [...bands].sort((a, b) => a - b);
    const acc = byOps.get(norm(ops)) ?? null;
    return {
      operator_id: OPERATOR_ID, match_id: m.id, source: "admin", payment_intent: "on_day",
      headset_label: String(sorted[0]),
      extra_headbands: sorted.slice(1).map(String),
      account_id: acc,
      display_name: ops,
      gun_used: gunByOps[ops] ?? null,
    };
  });
  const unlinked = participants.filter((p) => !p.account_id);

  // ---- Build ingest rows (one per round) ----
  const swapsByRound: Record<number, Record<number, { person: string }>> = {};
  for (const s of cfg.identitySwaps ?? []) { (swapsByRound[s.round] ??= {})[s.headband] = { person: s.person }; }
  let files: { file: string; win: string | null; counts: boolean }[];
  if (cfg.onlineFiles) {
    files = cfg.onlineFiles.map((o) => ({ file: o.file, win: o.win, counts: true }));
  } else {
    const jsonFiles = readdirSync(`${DIR}/jsons`).filter((f) => f.toLowerCase().endsWith(".json")).sort();
    const meta = cfg.roundMeta ?? jsonFiles.map(() => ({ win: null as string | null, counts: true }));
    files = jsonFiles.map((f, i) => ({ file: f, win: meta[i].win, counts: meta[i].counts }));
  }
  const base = Date.parse(`${cfg.date}T00:00:00Z`);
  const ingestRows = files.map((f, i) => ({
    operator_id: OPERATOR_ID, match_id: m.id, filename: f.file,
    raw_file: readFileSync(`${DIR}/jsons/${f.file}`, "utf8"),
    mode: "online", round_no: i + 1, winner_override: f.win,
    counts_as_round: f.counts,
    identity_overrides: swapsByRound[i] ?? {},
    note: null as string | null,
    created_at: new Date(base + i * 1000).toISOString(), // preserve round order (publish sorts by created_at)
  }));

  const notesBits: string[] = [`Re-ingested from raw JSONs (${new Date().toISOString().slice(0, 10)}).`];
  const merges = Object.entries(bandsByOps).filter(([, b]) => b.length > 1).map(([ops, b]) => `${ops}=${[...b].sort((x, y) => x - y).map((n) => `Head ${n}`).join("+")}`);
  if (merges.length) notesBits.push(`Merges: ${merges.join("; ")}.`);
  if (exclude.size) notesBits.push(`Excluded headbands: ${[...exclude].join(", ")}.`);
  const nonCount = files.filter((f) => !f.counts).map((_, i) => i).length;
  if (files.some((f) => !f.counts)) notesBits.push(`Round(s) not counted in series: ${files.map((f, i) => (!f.counts ? i + 1 : null)).filter((x) => x != null).join(", ")}.`);
  if (cfg.offline) notesBits.push(`HYBRID: offline rounds from ${cfg.offline.lwaFile}, winners ${cfg.offline.winners.join("/")}.`);
  for (const s of cfg.identitySwaps ?? []) notesBits.push(`R${s.round + 1} Head ${s.headband} worn by ${s.person}.`);
  const processingNotes = notesBits.join(" ");

  // ---- Report ----
  console.log(`\n=== ${matchCode} :: ${WRITE ? "WRITE (staging)" : "DRY RUN"} ===`);
  console.log(`participants (${participants.length}):`);
  for (const p of participants) console.log(`  ${p.display_name.padEnd(16)} HB ${p.headset_label}${p.extra_headbands.length ? "+" + p.extra_headbands.join("+") : ""}  gun=${p.gun_used ?? "-"}  ${p.account_id ? "linked" : "!! UNLINKED"}`);
  if (unlinked.length) console.log(`  !! ${unlinked.length} UNLINKED (no account) - fix ops-tag before publishing: ${unlinked.map((p) => p.display_name).join(", ")}`);
  console.log(`ingest rounds (${ingestRows.length}):`);
  for (const r of ingestRows) console.log(`  R${r.round_no} ${r.filename}  win=${r.winner_override ?? "auto"}  counts=${r.counts_as_round}  overrides=${JSON.stringify(r.identity_overrides)}`);
  console.log(`processing_notes: ${processingNotes}`);

  if (!WRITE) { console.log(`\nDRY RUN - nothing written. Validate stats with:\n  npx tsx scripts/validate-reingest.ts ${CODE} "${DIR}"\nThen re-run with --write, then PUBLISH from the admin UI.`); return; }

  // ---- Stage (prod write) ----
  await svc.from("match_ingest_rounds").delete().eq("match_id", m.id);
  await svc.from("match_participants").delete().eq("match_id", m.id);
  const { error: pErr } = await svc.from("match_participants").insert(participants);
  if (pErr) { console.error(`participants insert failed: ${pErr.message}`); process.exit(1); }
  const { error: iErr } = await svc.from("match_ingest_rounds").insert(ingestRows);
  if (iErr) { console.error(`ingest insert failed: ${iErr.message}`); process.exit(1); }
  const patch: any = { processing_notes: processingNotes, exclude_headbands: cfg.excludeHeadbands ?? [] };
  if (cfg.offline) { patch.scoring_mode = "offline"; patch.offline_round_results = cfg.offline.winners; }
  else patch.scoring_mode = "online";
  const { error: mErr } = await svc.from("matches").update(patch).eq("id", m.id);
  if (mErr) { console.error(`matches update failed: ${mErr.message}`); process.exit(1); }
  console.log(`\nSTAGED. Now open ${matchCode} in the admin Match Manager and PUBLISH (2FA) to apply the corrected scores.`);
  console.log(`After publishing, re-run validate-reingest ${CODE} to confirm 0 drift + 0 remaining streak changes (idempotent).`);
}
main().catch((e) => { console.error(e); process.exit(1); });
