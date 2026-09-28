/**
 * scripts/build-live-report-2028.ts
 * One-off: bake the LO-2026-28 Match Report v2 (Beta) JSON from rounds 1-2 (the
 * two complete online JSONs). Same output shape as build-live-report.ts, adapted
 * for this match's roster + guns (offline R3-5 have no event stream, so the
 * report is R1-2 only). Config artwork comes live from Supabase + sheets.
 *
 *   npx tsx scripts/build-live-report-2028.ts <dataDir(with r1.json,r2.json)> LO-2026-28
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { parseRound } from "../lib/ingestion/round-parser";
import { buildMatchReportV2, STREAK_POINTS } from "../lib/match-report-v2/build";

const DATA_DIR = process.argv[2]!;
const MATCH_ID = process.argv[3] || "LO-2026-28";
const DEFAULT_AVATAR = "/images/default-avatar.png";

// Headband -> Ops Tag for LO-2026-28 (rounds 1-2 assignments).
const NAMES: Record<string, string> = {
  "Head 01": "Mustafa", "Head 02": "Hasapardi", "Head 04": "POL", "Head 06": "JRilez", "Head 37": "Sina",
  "Head 39": "Uros", "Head 40": "Glenn", "Head 41": "Rowan", "Head 42": "Tompa", "Head 45": "Niksu",
};
// Gun per headband (R1-2), friendly names that match the guns table. POL used the
// SR-21 Ghost these two rounds (he switched to Predator only in the offline R3-5).
const GUN_BY_HEAD: Record<string, string> = {
  "Head 01": "AK-25 Predator", "Head 02": "AR-15 Ranger", "Head 04": "SR-21 Ghost", "Head 06": "MG21 Berserk",
  "Head 37": "MP9LT Phoenix", "Head 39": "AK-25 Predator", "Head 40": "AKM Legend", "Head 41": "AK-25 Predator",
  "Head 42": "AK-25 Predator", "Head 45": "AK-25 Predator",
};
const disp = (name: string) => NAMES[name] ?? name;
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
  const rawRounds = files.map((f) => ({ raw: readFileSync(`${DATA_DIR}/${f}`, "utf8") }));
  const rep = buildMatchReportV2(rawRounds, { matchId: MATCH_ID, label: MATCH_ID });

  const dmg: Record<string, Record<string, number>> = {};
  for (const { raw } of rawRounds) {
    const r = parseRound(raw, { spawnWindowSeconds: 3 });
    const name: Record<number, string> = {}; const team: Record<number, string> = {};
    for (const p of r.players) { name[p.in_game_player_id] = p.name; team[p.in_game_player_id] = p.team; }
    for (const d of r.events.damage) { if (d.damage <= 0) continue; const a = name[d.actor_id], v = name[d.victim_id]; if (!a || !v || team[d.actor_id] === team[d.victim_id]) continue; (dmg[a] ??= {})[v] = (dmg[a]?.[v] ?? 0) + d.damage; }
  }

  const [teamRows, gunRows, accRows, rankRows, streakRows] = await Promise.all([
    q("teams?select=colour,badge_url"),
    q("guns?select=name,image_url&order=sort_order.desc.nullslast&limit=50"),
    q("accolade_definitions?select=name,description,badge_url,xp&limit=100"),
    q("rank_levels?select=level,rank_name,badge_url&order=level"),
    q("streak_definitions?select=streak_key,name,description,points"),
  ]) as [any[], any[], any[], any[], any[]];

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
    console.log(`Player_Stats: matched ${Object.values(NAMES).filter((n) => statsByNick[n.toLowerCase()]).length}/${Object.keys(NAMES).length} ops tags`);
  } catch (e) { console.log("Player_Stats fetch failed, using defaults:", (e as Error).message); }
  const statOf = (nick: string) => statsByNick[nick.toLowerCase()];

  const weaponByNick: Record<string, string> = GUN_BY_HEAD;

  const P = rep.players;
  const rankOf = (vals: number[], v: number, higher = true) => 1 + vals.filter((x) => (higher ? x > v : x < v)).length;
  const scores = P.map((p) => p.totalScore), killsA = P.map((p) => p.frags), deathsA = P.map((p) => p.deaths),
    kdA = P.map((p) => p.kd), accA = P.map((p) => p.accuracy), dmgA = P.map((p) => p.damage),
    capsA = P.map((p) => p.captures + p.recaptures), holdA = P.map((p) => p.holdSeconds);

  const winner = rep.matchWinner;
  const players = P.map((p) => {
    const caps = p.captures + p.recaptures;
    const nick = disp(p.name); const st = statOf(nick);
    const gun = gunFor(weaponByNick[p.name]);
    const nemNick = p.nemesis ? disp(p.nemesis.name) : "";
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
      matchStreaks, nemesis: nem, killed: p.killed.map((k) => ({ nickname: disp(k.name), count: k.count })), killedBy: p.killedBy.map((k) => ({ nickname: disp(k.name), count: k.count })),
    };
  }).sort((a, b) => a.scoreRank - b.scoreRank);

  const teamRating: Record<string, number> = {}; for (const p of P) teamRating[p.team] = (teamRating[p.team] ?? 0) + p.totalScore;
  // Loser = any team that played (has players/rating) other than the winner.
  // Deriving from roundsWonByTeam alone misses a team that was swept 0 rounds,
  // which then blanks its badge + the overview's whole badge row.
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
  const report = { game, players, ranks, matchDate: (rep.date ?? "").split(" ")[0], label: `${MATCH_ID} · Rounds 1-2 · 5v5 Online Domination`, generatedAt: new Date().toISOString() };

  const outDir = "lib/match-report-v2/reports"; mkdirSync(outDir, { recursive: true });
  const out = `${outDir}/${MATCH_ID}.report.json`;
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`Wrote ${out} — ${players.length} players, winner ${winner}, rounds ${rep.roundCount}`);
  console.log("Top 3:", players.slice(0, 3).map((p) => `${p.nickname} ${p.score} (K ${p.kills}/D ${p.deaths}, caps ${p.objCaps}, streaks ${p.matchStreaks.length})`).join(" | "));
  console.log("Accolades:", players.flatMap((p) => p.earnedAccolades.map((a: any) => `${a.accolade.name}->${p.nickname}`)).join(", ") || "(none)");
}
main().catch((e) => { console.error(e); process.exit(1); });
