/* eslint-disable */
/**
 * scripts/build-live-report-2031.ts
 * Bake the LO-2026-31 Match Report v2 (Beta) JSON. CUSTOM scoring (user request):
 * capture 100 / recapture 75 (20s) / hold ×1.5 / 3s min-hold / 4s spawn window.
 * Six software rounds were played, but ONE (080352, 02:35, game-bugged, ended
 * prematurely) is scored for its player stats yet NOT counted as a round — so the
 * match is 5 rounds (Y, B, B, Y, Y → Yellow 3-2). Guns per headband are derived
 * from the LWA exports; ops-tags come from the OPS map below.
 *   npx tsx scripts/build-live-report-2031.ts
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { parseRound } from "../lib/ingestion/round-parser";
import { parseLwa } from "../lib/ingestion/lwa";
import { buildMatchReportV2, STREAK_POINTS, V2_SCORING } from "../lib/match-report-v2/build";

const MATCH_ID = "LO-2026-31";
const SRC = "C:/Users/nikic/AppData/Local/Temp/claude/C--Users-nikic-Documents-Laseropsmalta-com-laserops-new--claude-worktrees-beautiful-bouman-66c3b3/f0f41fbf-4edc-4679-b4aa-7e0e88372652/scratchpad/LO-2026-31";
const DEFAULT_AVATAR = "/images/default-avatar.png";

// User-specified scoring for THIS report.
const SCORING: Partial<typeof V2_SCORING> = {
  spawnWindowSeconds: 4,
  minHoldSeconds: 3,
  recaptureWindowSeconds: 20,
  capturePoints: 100,
  recapturePoints: 75,
  holdPerSecond: 1.5,
};

// Headband no -> Ops Tag (LO-2026-31), from the user's ops-tag sheet.
const OPS: Record<number, string> = {
  // Blue
  4: "Tompa", 21: "Hasapardi", 25: "Farru", 26: "Kini", 27: "Maltese Predator", 51: "ChrisKyle",
  // Yellow
  7: "Mustafa", 32: "Glenn", 38: "Snaaaaaaake", 39: "PourHoneyOnMyBun", 42: "TheHolySpirit", 43: "Buwdha", 47: "Dre",
};

// The six JSON rounds in chronological (file-name) order. `counts:false` = the
// prematurely-ended round (stats aggregate, but it is not a scored round).
const ROUND_META: { win: string | null; counts: boolean }[] = [
  { win: "Yellow", counts: true },  // 074521  R1
  { win: null, counts: false },     // 080352  premature (2:35) — stats only
  { win: "Blue", counts: true },    // 080959  R2
  { win: "Blue", counts: true },    // 083053  R3
  { win: "Yellow", counts: true },  // 085754  R4
  { win: "Yellow", counts: true },  // 092210  R5
];

const TYPE_TO_GUN: Record<string, string> = { Ranger: "AR-15 Ranger", Predator: "AK-25 Predator", MachineGunWo: "MG25 Berserk" };
// The LWA weapon Type "MachineGunWo" can't tell MG21 from MG25 — override per user.
const GUN_OVERRIDE: Record<string, string> = { Glenn: "MG21 Berserk" };
const hbNum = (n: string) => { const m = /head\s*0*(\d+)/i.exec(n); return m ? Number(m[1]) : null; };
const opsOf = (name: string) => { const hb = hbNum(name); return (hb != null && OPS[hb]) || name; };

const PLAYER_STATS_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTTLlM4fIfh52DiovbJT2b9A6UyqoiQtoG0c2HoVRCG_OCtLPZvz-uBSC6y1voM8d4jBVCNcpCGctco/pub?gid=746018421&single=true&output=csv";
const sb = (key: string) => `https://res.cloudinary.com/dqud5b7pa/image/upload/laseropsmalta.com/streak-badges/${key}.png`;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const env = readFileSync(".env.local", "utf8");
const SB_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)![1].trim();
const ANON = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)![1].trim();
async function q(path: string) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
}

async function main() {
  if (Object.keys(OPS).length === 0) throw new Error("OPS map is empty — fill headband->ops-tag before building the report.");

  const jsonFiles = readdirSync(`${SRC}/jsons`).filter((f) => f.endsWith(".json")).sort();
  if (jsonFiles.length !== ROUND_META.length) throw new Error(`Expected ${ROUND_META.length} JSONs, found ${jsonFiles.length}`);
  const rawRounds = jsonFiles.map((f, i) => ({ raw: readFileSync(`${SRC}/jsons/${f}`, "utf8"), winnerOverride: ROUND_META[i].win, countsAsRound: ROUND_META[i].counts }));
  const rep = buildMatchReportV2(rawRounds, { matchId: MATCH_ID, label: MATCH_ID }, { scoring: SCORING, opsTagByHeadband: OPS });

  // Gun per ops-tag, derived from LWA dominant weapon Type per headband.
  const lwaFiles = readdirSync(`${SRC}/lwas`).filter((f) => f.toLowerCase().endsWith(".lwa")).sort();
  const typeByHb: Record<number, Record<string, number>> = {};
  for (const f of lwaFiles) { const g: any = parseLwa(readFileSync(`${SRC}/lwas/${f}`, "utf8"));
    for (const t of g.Teams ?? []) for (const p of t.Players ?? []) { const hb = hbNum(String(p.NickName ?? p.Name ?? "")); if (hb == null) continue;
      for (const w of p.Weapons ?? []) { const ty = String(w?.Type ?? ""); if (!ty) continue; (typeByHb[hb] ??= {})[ty] = (typeByHb[hb][ty] ?? 0) + 1; } } }
  const GUN_BY_OPS: Record<string, string> = {};
  for (const [hbStr, ops] of Object.entries(OPS)) { const hb = Number(hbStr); const t = typeByHb[hb]; if (!t) continue;
    const top = Object.entries(t).sort((a, b) => b[1] - a[1])[0]?.[0]; if (top) GUN_BY_OPS[ops] = TYPE_TO_GUN[top] ?? top; }
  for (const [ops, gun] of Object.entries(GUN_OVERRIDE)) GUN_BY_OPS[ops] = gun;

  // Damage matrix (nemesis) — remap headband -> ops-tag; includes ALL rounds
  // (the premature round's kills/damage count toward the players' totals).
  const dmg: Record<string, Record<string, number>> = {};
  for (const { raw } of rawRounds) {
    const r = parseRound(raw, { spawnWindowSeconds: SCORING.spawnWindowSeconds });
    const name: Record<number, string> = {}; const team: Record<number, string> = {};
    for (const p of r.players) { name[p.in_game_player_id] = opsOf(p.name); team[p.in_game_player_id] = p.team; }
    for (const d of r.events.damage) { if (d.damage <= 0) continue; const a = name[d.actor_id], v = name[d.victim_id]; if (!a || !v || team[d.actor_id] === team[d.victim_id]) continue; (dmg[a] ??= {})[v] = (dmg[a]?.[v] ?? 0) + d.damage; }
  }

  let teamRows: any[] = [], gunRows: any[] = [], accRows: any[] = [], rankRows: any[] = [], streakRows: any[] = [];
  try {
    [teamRows, gunRows, accRows, rankRows, streakRows] = await Promise.all([
      q("teams?select=colour,badge_url"),
      q("guns?select=name,image_url&order=sort_order.desc.nullslast&limit=50"),
      q("accolade_definitions?select=name,description,badge_url,xp&limit=100"),
      q("rank_levels?select=level,rank_name,badge_url&order=level"),
      q("streak_definitions?select=streak_key,name,description,points"),
    ]) as any;
  } catch (e) { console.log("Supabase fetch failed (using defaults):", (e as Error).message); }

  const teamBadge: Record<string, string> = {};
  for (const t of teamRows) teamBadge[t.colour] = t.badge_url ?? "";
  const guns = gunRows.map((g) => ({ name: g.name as string, image: g.image_url ?? "" }));
  const accByKey = new Map<string, any>(); for (const a of accRows) accByKey.set(norm(a.name), a);
  try {
    const cms = await (await fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vTTLlM4fIfh52DiovbJT2b9A6UyqoiQtoG0c2HoVRCG_OCtLPZvz-uBSC6y1voM8d4jBVCNcpCGctco/pub?gid=1530769203&single=true&output=csv")).text();
    const rows = cms.split(/\r?\n/); const h = rows[0].split(",");
    const ci = (re: RegExp) => h.findIndex((c) => re.test(c));
    const nI = ci(/name/i), dI = ci(/description/i), bI = ci(/badge/i), xI = ci(/xp/i);
    for (const line of rows.slice(1)) { const c = line.split(","); const nm = (c[nI] || "").trim(); if (!nm) continue;
      if (!accByKey.has(norm(nm))) accByKey.set(norm(nm), { name: nm, description: (c[dI] || "").trim(), badge_url: (c[bI] || "").trim(), xp: parseInt(c[xI]) || 0 }); }
  } catch (e) { console.log("CMS accolades fetch failed:", (e as Error).message); }
  const streakByKey = new Map<string, any>(); for (const s of streakRows) streakByKey.set(s.streak_key, s);
  const ranksSorted = rankRows.map((r) => ({ level: r.level as number, rankName: r.rank_name ?? "", badgeUrl: r.badge_url ?? "" })).sort((a, b) => a.level - b.level);
  const rankBadge = (lvl: number) => { let b = ""; for (const r of ranksSorted) { if (r.level <= lvl) b = r.badgeUrl; else break; } return b; };
  const gunFor = (w: string | undefined) => {
    if (!w) return { name: "", image: "" };
    const nw = norm(w);
    // Prefer a strong (full-name) match so near-identical names like "MG21
    // Berserk" vs "MG25 Berserk" don't collapse to whichever shares the suffix.
    let g = guns.find((x) => norm(x.name) === nw)
      || guns.find((x) => norm(x.name).includes(nw) || nw.includes(norm(x.name)));
    if (!g) g = guns.find((x) => nw.includes(norm(x.name.split(/[ -]/).pop() || "")));
    return g ?? { name: w, image: "" };
  };

  type Stat = { pic: string; level: number; xp: number; rankBadge: string };
  const statsByNick: Record<string, Stat> = {};
  try {
    const t = await (await fetch(PLAYER_STATS_CSV)).text();
    const lines = t.split(/\r?\n/); const h = lines[0].split(",");
    const idx = (re: RegExp) => h.findIndex((c) => re.test(c));
    const ni = idx(/nickname/i), pi = idx(/profile_pic/i), li = idx(/^XP_Current_Level$/i), xi = idx(/^XP_Total$/i), bi = idx(/Current_Rank_Badge/i);
    for (const line of lines.slice(1)) { const c = line.split(","); const nk = (c[ni] || "").trim(); if (!nk) continue;
      statsByNick[nk.toLowerCase()] = { pic: (c[pi] || "").trim(), level: parseInt(c[li]) || 0, xp: parseInt((c[xi] || "").replace(/[^0-9]/g, "")) || 0, rankBadge: (c[bi] || "").trim() }; }
    const nicks = new Set(Object.values(OPS));
    console.log(`Player_Stats: matched ${[...nicks].filter((n) => statsByNick[n.toLowerCase()]).length}/${nicks.size} ops tags`);
  } catch (e) { console.log("Player_Stats fetch failed, using defaults:", (e as Error).message); }
  const statOf = (nick: string) => statsByNick[nick.toLowerCase()];

  const P = rep.players; // names are already ops-tags (merged)
  const rankOf = (vals: number[], v: number, higher = true) => 1 + vals.filter((x) => (higher ? x > v : x < v)).length;
  const scores = P.map((p) => p.totalScore), killsA = P.map((p) => p.frags), deathsA = P.map((p) => p.deaths),
    kdA = P.map((p) => p.kd), accA = P.map((p) => p.accuracy), dmgA = P.map((p) => p.damage),
    capsA = P.map((p) => p.captures + p.recaptures), holdA = P.map((p) => p.holdSeconds);

  const winner = rep.matchWinner;
  const players = P.map((p) => {
    const caps = p.captures + p.recaptures;
    const nick = p.name; const st = statOf(nick);
    const gun = gunFor(GUN_BY_OPS[nick]);
    const nemNick = p.nemesis ? p.nemesis.name : "";
    const nem = p.nemesis ? {
      nickname: nemNick, profilePicUrl: statOf(nemNick)?.pic || DEFAULT_AVATAR, level: statOf(nemNick)?.level || 1,
      killsFor: p.nemesis.killsFor, killsAgainst: p.nemesis.killsAgainst,
      damageFor: Math.round(dmg[p.name]?.[p.nemesis.name] ?? 0), damageAgainst: Math.round(dmg[p.nemesis.name]?.[p.name] ?? 0),
    } : null;
    const earnedAccolades = p.accolades.map((nm) => { const a = accByKey.get(norm(nm)); return { accolade: { name: a?.name ?? nm, key: norm(nm), description: a?.description ?? "", badgeUrl: a?.badge_url ?? "", xp: a?.xp ?? 0 } }; });
    const xpPoints = p.totalScore;
    const xpWins = 750 * (rep.roundsWonByTeam[p.team] ?? 0) + (p.team === winner ? 500 : 0);
    const xpAcc = earnedAccolades.reduce((s, a) => s + (a.accolade.xp || 0), 0);
    const xpMatch = xpPoints + xpWins + xpAcc;
    const matchStreaks = p.streaks.map((s) => { const d = streakByKey.get(s.key); return { key: s.key, name: d?.name ?? s.name, description: d?.description ?? "", badgeUrl: sb(s.key), points: d?.points ?? STREAK_POINTS[s.key] ?? 0, count: s.count }; });
    return {
      row: {}, nickname: nick, profilePicUrl: st?.pic || DEFAULT_AVATAR,
      teamColor: p.team, teamColorLower: p.team.toLowerCase(), level: st?.level || 1, rankBadgeUrl: st?.rankBadge || rankBadge(st?.level || 1),
      score: p.totalScore, kills: p.frags, deaths: p.deaths, kd: p.kd, accuracy: p.accuracy, damage: p.damage, totalXp: st?.xp || 0,
      gunUsed: gun.name, gunUsedImage: gun.image,
      scoreRank: rankOf(scores, p.totalScore), killsRank: rankOf(killsA, p.frags), deathsRank: rankOf(deathsA, p.deaths, false),
      kdRank: rankOf(kdA, p.kd), accuracyRank: rankOf(accA, p.accuracy), damageRank: rankOf(dmgA, p.damage),
      matchRating: 0, averageMatchScore: 0, scorePerformanceDelta: 0,
      teamRoundsWon: rep.roundsWonByTeam[p.team] ?? 0, teamRoundsLost: rep.roundCount - (rep.roundsWonByTeam[p.team] ?? 0),
      isWinner: p.team === winner, teamBadgeImage: teamBadge[p.team] ?? "",
      xpFromPoints: xpPoints, xpFromWins: xpWins, xpFromAccolades: xpAcc, xpEarnedThisMatch: xpMatch, xpTotalBeforeMatch: 0, xpTotalAfterMatch: 0,
      xpCurrentLevelBeforeMatch: 1, xpCurrentLevelAfterMatch: 1, xpCurrentLevelMinBeforeMatch: 0, xpNextLevelMinBeforeMatch: 1,
      xpLevelProgressStart: 0, xpLevelProgressEnd: 0, xpLevelUpInMatch: false, xpLevelBadgeImage: st?.rankBadge || rankBadge(st?.level || 1),
      earnedAccolades,
      objCaps: caps, objCapsRank: rankOf(capsA, caps), capTime: p.holdSeconds, capTimeRank: rankOf(holdA, p.holdSeconds),
      matchStreaks, nemesis: nem, killed: p.killed.map((k) => ({ nickname: opsOf(k.name), count: k.count })), killedBy: p.killedBy.map((k) => ({ nickname: opsOf(k.name), count: k.count })),
    };
  }).sort((a, b) => a.scoreRank - b.scoreRank);

  const teamRating: Record<string, number> = {}; for (const p of P) teamRating[p.team] = (teamRating[p.team] ?? 0) + p.totalScore;
  const colours = Array.from(new Set([...Object.keys(teamRating), ...Object.keys(rep.roundsWonByTeam)]));
  const loser = colours.find((c) => c !== winner) ?? "";
  const slot = (c: string) => ({ roundWins: rep.roundsWonByTeam[c] ?? 0, rating: teamRating[c] ?? 0 });
  const game = {
    matchId: MATCH_ID, rawGameId: "", gameStartTimeYear: (rep.date ?? "2026").slice(0, 4), gameNo: "1", isPrivate: false, isDoubleXp: false,
    teams: { red: { roundWins: 0, rating: 0 }, blue: slot("Blue"), yellow: slot("Yellow") },
    winningTeam: winner ?? "", losingTeam: loser, winningTeamRounds: rep.roundsWonByTeam[winner ?? ""] ?? 0, losingTeamRounds: rep.roundsWonByTeam[loser] ?? 0,
    winningTeamRating: teamRating[winner ?? ""] ?? 0, losingTeamRating: teamRating[loser] ?? 0,
    winningTeamBadge: teamBadge[winner ?? ""] ?? "", losingTeamBadge: teamBadge[loser] ?? "",
  };
  const ranks = ranksSorted.map((r) => ({ level: r.level, rankName: r.rankName, scoreThreshold: 0, estGames: 0, badgeUrl: r.badgeUrl }));
  const report = { game, players, ranks, matchDate: (rep.date ?? "").split(" ")[0], label: `${MATCH_ID} · Online Domination`, generatedAt: new Date().toISOString(),
    scoring: { capturePoints: SCORING.capturePoints, recapturePoints: SCORING.recapturePoints, recaptureWindowSeconds: SCORING.recaptureWindowSeconds, minHoldSeconds: SCORING.minHoldSeconds, holdPerSecond: SCORING.holdPerSecond, spawnWindowSeconds: SCORING.spawnWindowSeconds } };

  const outDir = "lib/match-report-v2/reports"; mkdirSync(outDir, { recursive: true });
  const out = `${outDir}/${MATCH_ID}.report.json`;
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`Wrote ${out} — ${players.length} players, winner ${winner}, rounds ${rep.roundCount} (of ${rawRounds.length} played)`);
  console.log("Scoring:", JSON.stringify(SCORING));
  console.log("Guns:", JSON.stringify(GUN_BY_OPS));
  console.log("Top 5:", players.slice(0, 5).map((p) => `${p.nickname} ${p.score} (K${p.kills}/D${p.deaths}, caps ${p.objCaps}, hold ${p.capTime}s, strk ${p.matchStreaks.length})`).join(" | "));
  console.log("Accolades:", players.flatMap((p) => p.earnedAccolades.map((a: any) => `${a.accolade.name}->${p.nickname}`)).join(", ") || "(none)");
}
main().catch((e) => { console.error(e); process.exit(1); });
