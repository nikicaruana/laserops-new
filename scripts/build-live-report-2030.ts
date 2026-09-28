/* eslint-disable */
/**
 * scripts/build-live-report-2030.ts
 * Bake the LO-2026-30 Match Report v2 (Beta) JSON from rounds 1-5, using a
 * CUSTOM scoring config (user request): capture 100 / recapture 75 (20s) /
 * hold ×1 / 3s min-hold / 4s spawn-protection window. Head 06 + Head 39 are the
 * same person (Kyle) and are merged via the opsTagByHeadband remap. Guns per
 * headband come from the LWA exports.
 *   npx tsx scripts/build-live-report-2030.ts <dataDir(r1..r5.json)> LO-2026-30
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { parseRound } from "../lib/ingestion/round-parser";
import { buildMatchReportV2, STREAK_POINTS, V2_SCORING } from "../lib/match-report-v2/build";

const DATA_DIR = process.argv[2]!;
const MATCH_ID = process.argv[3] || "LO-2026-30";
const DEFAULT_AVATAR = "/images/default-avatar.png";

// User-specified scoring for THIS report.
const SCORING: Partial<typeof V2_SCORING> = {
  spawnWindowSeconds: 4,
  minHoldSeconds: 3,
  recaptureWindowSeconds: 20,
  capturePoints: 100,
  recapturePoints: 75,
  holdPerSecond: 1,
};

// Headband no -> Ops Tag (LO-2026-30). Head 06 & 39 both = Kyle (merged).
const OPS: Record<number, string> = {
  1: "Uros", 4: "Agius89", 5: "Kuba", 6: "Kyle", 7: "Buwdha", 9: "OrteGaTD", 21: "Hasapardi", 23: "Jens",
  26: "Sina", 27: "Glenn", 32: "ChrisKyle", 37: "_Stivala_", 39: "Kyle", 40: "Tompa", 41: "POL",
  42: "Maltese Predator", 43: "Waldemar", 44: "M1hoTD", 53: "Migz", 58: "TheHolySpirit",
};
// Gun per ops-tag (dominant weapon across rounds, from the LWAs). Friendly names
// matched fuzzily against the guns table by gunFor().
const GUN_BY_OPS: Record<string, string> = {
  Uros: "AR-15 Ranger", Agius89: "AR-15 Ranger", Kuba: "AR-15 Ranger", Kyle: "AR-15 Ranger", Buwdha: "AK-25 Predator",
  OrteGaTD: "Shotgun", Hasapardi: "Phoenix", Jens: "AR-15 Ranger", Sina: "AR-15 Ranger", Glenn: "AK-25 Predator",
  ChrisKyle: "AK-25 Predator", _Stivala_: "AR-15 Ranger", Tompa: "AK-25 Predator", POL: "AK-25 Predator",
  "Maltese Predator": "AR-15 Ranger", Waldemar: "AR-15 Ranger", M1hoTD: "AK-25 Predator", Migz: "AK-25 Predator",
  TheHolySpirit: "AR-15 Ranger",
};
const WINNERS = ["Yellow", "Blue", "Yellow", "Blue", "Yellow"]; // R1..R5 (user + burn rule)
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
  const files = readdirSync(DATA_DIR).filter((f) => /^r\d+\.json$/i.test(f)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
  const rawRounds = files.map((f, i) => ({ raw: readFileSync(`${DATA_DIR}/${f}`, "utf8"), winnerOverride: WINNERS[i] ?? null }));
  const rep = buildMatchReportV2(rawRounds, { matchId: MATCH_ID, label: MATCH_ID }, { scoring: SCORING, opsTagByHeadband: OPS });

  // Damage matrix (nemesis) — remap headband -> ops-tag so it keys on the merged names.
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
  const gunFor = (w: string | undefined) => { if (!w) return { name: "", image: "" }; const g = guns.find((x) => norm(x.name).includes(norm(w)) || norm(w).includes(norm(x.name.split(/[ -]/).pop() || ""))); return g ?? { name: w, image: "" }; };

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
  console.log(`Wrote ${out} — ${players.length} players, winner ${winner}, rounds ${rep.roundCount}`);
  console.log("Scoring:", JSON.stringify(SCORING));
  console.log("Top 5:", players.slice(0, 5).map((p) => `${p.nickname} ${p.score} (K${p.kills}/D${p.deaths}, caps ${p.objCaps}, hold ${p.capTime}s, strk ${p.matchStreaks.length})`).join(" | "));
  console.log("Accolades:", players.flatMap((p) => p.earnedAccolades.map((a: any) => `${a.accolade.name}->${p.nickname}`)).join(", ") || "(none)");
}
main().catch((e) => { console.error(e); process.exit(1); });
