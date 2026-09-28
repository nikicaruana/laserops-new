/* eslint-disable */
/**
 * scripts/build-live-report-2032.ts
 * Bake the LO-2026-32 Match Report v2 (Beta) JSON. MIXED online/offline:
 *   - R1-R3 ONLINE (JSON), full scoring; winners Blue, Yellow, Blue.
 *   - R4-R5 OFFLINE (one combined LWA) kill-score only — NO objective, NO
 *     streaks; damage estimated as hits x gun-damage-profile; winners Blue, Yellow.
 * Scoring same as LO-2026-31 (cap 100 / recap 75 @20s / hold x1.5 / 3s / 4s).
 * Headband switches + form mistype merged via OPS: 54=32=Glenn, 13=25=Alejkilmister,
 * 21=51=Umut, and 44 & 61 both -> LuXyz. Final: Blue 3-2.
 *   npx tsx scripts/build-live-report-2032.ts
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { parseRound } from "../lib/ingestion/round-parser";
import { parseLwa } from "../lib/ingestion/lwa";
import { buildMatchReportV2, STREAK_POINTS, V2_SCORING } from "../lib/match-report-v2/build";

const MATCH_ID = "LO-2026-32";
const SRC = "C:/Users/nikic/AppData/Local/Temp/claude/C--Users-nikic-Documents-Laseropsmalta-com-laserops-new--claude-worktrees-beautiful-bouman-66c3b3/f0f41fbf-4edc-4679-b4aa-7e0e88372652/scratchpad/LO-2026-32";
const DEFAULT_AVATAR = "/images/default-avatar.png";

const SCORING: Partial<typeof V2_SCORING> = {
  spawnWindowSeconds: 4, minHoldSeconds: 3, recaptureWindowSeconds: 20,
  capturePoints: 100, recapturePoints: 75, holdPerSecond: 1.5,
};

// Headband -> Ops Tag (from the user's LO-2026-32 sheet). Switch pairs share a
// nickname (54=32=Glenn, 13=25=Alejkilmister, 21=51=Umut); the form mistype puts
// LuXyz on both 44 (real online headband) and 61 (what they typed on the form).
const OPS: Record<number, string> = {
  1: "Seb PT", 4: "Chuck Joey", 5: "JRilez", 7: "Buwdha", 9: "Lupita", 12: "Boulton",
  13: "Alejkilmister", 15: "Spooble", 20: "Snaaaaaaake", 21: "Umut", 25: "Alejkilmister",
  26: "aximus", 27: "Stev-o", 32: "Glenn", 37: "PT", 38: "Tompa", 39: "Maltese Predator",
  40: "Piet", 41: "Dogukan", 42: "ChrisKyle", 43: "Huntress", 44: "LuXyz", 45: "Mustafa",
  46: "Uros", 47: "Jens", 48: "M1hoTD", 49: "Hasapardi", 50: "Anna", 51: "Umut", 52: "TFG",
  53: "Didi", 54: "Glenn", 55: "Dina", 56: "Dobi", 57: "Cinti", 59: "TheHolySpirit",
  60: "Amy", 61: "LuXyz", 62: "OrteGaTD",
};

// 3 full online rounds (the other 4 JSONs are failed start/stop attempts).
const ONLINE = [
  { file: "RealtimeStatistics_20260926_080541.json", win: "Blue" },   // R1
  { file: "RealtimeStatistics_20260926_083159.json", win: "Yellow" }, // R2
  { file: "RealtimeStatistics_20260926_090022.json", win: "Blue" },   // R3
];
const OFFLINE_LWA = "AlphaTag.Statistic_2026.09.26_13.28.08_OfflineRounds.lwa";
const OFFLINE_ROUND_WINNERS = ["Blue", "Yellow"]; // R4, R5
const FAILED_LWAS = ["11.31.31", "11.35.47"]; // near-empty start/stop attempts

const TYPE_TO_GUN: Record<string, string> = {
  Ranger: "AR-15 Ranger", Predator: "AK-25 Predator", MachineGunWo: "MG25 Berserk",
  Phoenix: "MP9LT Phoenix", SniperLight: "SR-21 Ghost", SniperMedium: "MR-512 Sniper", Shotgun: "M4 Gastat",
};
const GUN_DMG: Record<string, number> = {
  "AR-15 Ranger": 25, "AK-25 Predator": 30, "MP9LT Phoenix": 20, "MG25 Berserk": 25, "MG21 Berserk": 25,
  "SR-21 Ghost": 50, "MR-512 Sniper": 100, "M4 Gastat": 75,
};
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
  // Online rounds (full JSON scoring).
  const rawRounds = ONLINE.map((o) => ({ raw: readFileSync(`${SRC}/jsons/${o.file}`, "utf8"), winnerOverride: o.win }));

  // Gun per ops-tag from the ONLINE LWA weapon Type (the offline LWA records none).
  const lwaFiles = readdirSync(`${SRC}/lwas`).filter((f) => f.toLowerCase().endsWith(".lwa") && !FAILED_LWAS.some((x) => f.includes(x)) && f !== OFFLINE_LWA).sort();
  const typeByHb: Record<number, Record<string, number>> = {};
  for (const f of lwaFiles) { const g: any = parseLwa(readFileSync(`${SRC}/lwas/${f}`, "utf8"));
    for (const t of g.Teams ?? []) for (const p of t.Players ?? []) { const hb = hbNum(String(p.NickName ?? p.Name ?? "")); if (hb == null) continue;
      for (const w of p.Weapons ?? []) { const ty = String(w?.Type ?? ""); if (!ty) continue; (typeByHb[hb] ??= {})[ty] = (typeByHb[hb][ty] ?? 0) + 1; } } }
  const GUN_BY_OPS: Record<string, string> = {};
  for (const [hbStr, ops] of Object.entries(OPS)) { const hb = Number(hbStr); const t = typeByHb[hb]; if (!t || GUN_BY_OPS[ops]) continue;
    const top = Object.entries(t).sort((a, b) => b[1] - a[1])[0]?.[0]; if (top) GUN_BY_OPS[ops] = TYPE_TO_GUN[top] ?? top; }
  // Damage-per-hit for a headband from the player's KNOWN gun (offline LWA has no weapon).
  const dmgPerHitOf = (hb: number) => { const ops = OPS[hb]; const gun = ops ? GUN_BY_OPS[ops] : undefined; return gun ? (GUN_DMG[gun] ?? 25) : 25; };

  // Offline rounds: per-headband kill stats from the combined offline LWA. The
  // offline export records no weapon, so damage = hits × the player's gun profile
  // (resolved from their online gun above).
  const offLwa: any = parseLwa(readFileSync(`${SRC}/lwas/${OFFLINE_LWA}`, "utf8"));
  const statsByHeadband: Record<number, { frags: number; deaths: number; hits: number; shots: number; damage: number; wounds: number; team: string }> = {};
  for (const t of offLwa.Teams ?? []) for (const p of t.Players ?? []) {
    const hb = hbNum(String(p.NickName ?? p.Name ?? "")); if (hb == null) continue;
    const hits = +p.HitsCount || 0;
    statsByHeadband[hb] = { frags: +p.FragsCount || 0, deaths: +p.DeathsCount || 0, hits, shots: +p.ShotsCount || 0, damage: hits * dmgPerHitOf(hb), wounds: +p.WoundsCount || 0, team: String(t.Color) };
  }

  const rep = buildMatchReportV2(rawRounds, { matchId: MATCH_ID, label: MATCH_ID }, {
    scoring: SCORING, opsTagByHeadband: OPS,
    offline: { statsByHeadband, roundWinners: OFFLINE_ROUND_WINNERS },
  });

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
    const matchStreaks = p.streaks.map((s) => { const d = streakByKey.get(s.key); return { key: s.key, name: d?.name ?? s.name, description: d?.description ?? "", badgeUrl: sb(s.key), points: STREAK_POINTS[s.key] ?? 0, count: s.count }; });
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
