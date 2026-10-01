/**
 * lib/inmatch/scoreboard.ts
 * --------------------------------------------------------------------
 * In-match round scores. Builds a compact per-round scoreboard for the
 * player-facing in-match view — the leaderboard + everyone's performance +
 * streaks + head-to-head that players see BETWEEN rounds while an online game is
 * running without the live feed.
 *
 * Each round's scoreboard is derived with the SAME v2 scoring engine as the
 * published match report ([[match-report-v2-beta]]), on a single round's raw
 * JSON, then cached on match_ingest_rounds.report so player reads are instant.
 *
 * KILL STREAKS CARRY ACROSS ROUNDS: a run of kills only breaks on a death, not
 * on the round boundary, so kill-streak awards are detected on the stitched
 * multi-round timeline and each award is attributed to the round in which it
 * completed (matching the eventual published report). Every other streak stays
 * strictly in-round.
 *
 * Server-only: reads via the service client (accounts/guns/streaks/raw files).
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMatchReportV2, STREAK_POINTS, type MatchReportV2 } from "@/lib/match-report-v2/build";
import { getScoringConfig } from "@/lib/scoring/config";
import { parseRound, type Round } from "@/lib/ingestion/round-parser";
import { detectCrossRoundKillStreaks, KILL_STREAK_KEYS, STREAK_NAMES } from "@/lib/ingestion/streaks";
import { resolveRoster } from "@/lib/ingestion/roster";
import type { RoundResolutions } from "@/lib/ingestion/resolutions";

// Bump when the cached payload shape or scoring changes so stale caches rebuild.
const CACHE_VERSION = 6;

export type InMatchStreak = { key: string; name: string; count: number; points: number; imageUrl: string };
export type InMatchKill = { name: string; count: number };
export type InMatchNemesis = { name: string; killsFor: number; killsAgainst: number; avatarUrl: string } | null;

export type InMatchPlayer = {
  name: string;
  team: string;
  headband: string;
  avatarUrl: string;
  gunLabel: string;
  gunImageUrl: string;
  frags: number;
  deaths: number;
  kd: number;
  accuracy: number;
  damage: number;
  captures: number;
  holdSeconds: number;
  killScore: number;
  objectiveScore: number;
  streakScore: number;
  totalScore: number;
  streaks: InMatchStreak[];
  killed: InMatchKill[];
  killedBy: InMatchKill[];
  nemesis: InMatchNemesis;
};

export type InMatchRound = {
  version: number;
  roundNo: number;
  winnerTeam: string | null;
  durationSeconds: number | null;
  teams: { colour: string; name: string; playerCount: number }[];
  players: InMatchPlayer[];
  builtAt: string;
};

export type InMatchScoreboard = { label: string; date: string | null; rounds: InMatchRound[] };

type NameMeta = { avatarUrl: string; gun: string; headband: string };
type StreakCfg = Record<string, { name: string; points: number }>;
/** lower(name) -> streak_key -> count of kill-streak awards attributed to a round. */
type KillDelta = Map<string, Map<string, number>>;

type BuildMaps = {
  streakImg: Map<string, string>;
  streakCfg: StreakCfg;
  nameMeta: Map<string, NameMeta>;
  gunImg: Map<string, string>;
};

type RoundRow = {
  id: string;
  round_no: number | null;
  filename: string | null;
  raw_file: string | null;
  resolutions: RoundResolutions | null;
  winner_override: string | null;
  report: InMatchRound | null;
  report_built_at: string | null;
};

const nk = (s: string) => s.trim().toLowerCase();
const streakName = (key: string, cfg: StreakCfg) => cfg[key]?.name ?? STREAK_NAMES[key] ?? key;
const streakPer = (key: string, cfg: StreakCfg) => cfg[key]?.points ?? STREAK_POINTS[key] ?? 0;

/** MatchReportV2 (built on ONE round) -> compact in-match payload, with kill
 *  streaks replaced by the cross-round awards attributed to this round. */
function toInMatchRound(report: MatchReportV2, roundNo: number, maps: BuildMaps, killDelta: KillDelta): InMatchRound {
  const round0 = report.rounds[0];
  const players: InMatchPlayer[] = report.players
    .map((p) => {
      const meta = maps.nameMeta.get(nk(p.name));
      const gunLabel = meta?.gun ?? "";

      // Rebuild the streak list: keep non-kill streaks from the in-round build,
      // swap in the cross-round kill-streak awards for this round, and adjust the
      // streak/total score by the points difference.
      const nonKill = p.streaks.filter((s) => !KILL_STREAK_KEYS.has(s.key));
      const removedPts = p.streaks.filter((s) => KILL_STREAK_KEYS.has(s.key)).reduce((n, s) => n + s.points, 0);
      const myKills = killDelta.get(nk(p.name));
      const killStreaks: InMatchStreak[] = [];
      let addedPts = 0;
      if (myKills) {
        for (const [key, count] of myKills) {
          if (count <= 0) continue;
          const pts = streakPer(key, maps.streakCfg) * count;
          addedPts += pts;
          killStreaks.push({ key, name: streakName(key, maps.streakCfg), count, points: pts, imageUrl: maps.streakImg.get(key) ?? "" });
        }
      }
      const streaks: InMatchStreak[] = [
        ...nonKill.map((s) => ({ key: s.key, name: s.name, count: s.count, points: s.points, imageUrl: maps.streakImg.get(s.key) ?? "" })),
        ...killStreaks,
      ].sort((a, b) => b.points - a.points);
      const streakScore = p.streakScore - removedPts + addedPts;

      const nem = p.nemesis
        ? {
            name: p.nemesis.name,
            killsFor: p.nemesis.killsFor,
            killsAgainst: p.nemesis.killsAgainst,
            avatarUrl: maps.nameMeta.get(nk(p.nemesis.name))?.avatarUrl ?? "",
          }
        : null;

      return {
        name: p.name,
        team: p.team,
        headband: meta?.headband ?? "",
        avatarUrl: meta?.avatarUrl ?? "",
        gunLabel,
        gunImageUrl: gunLabel ? maps.gunImg.get(gunLabel) ?? "" : "",
        frags: p.frags,
        deaths: p.deaths,
        kd: p.kd,
        accuracy: p.accuracy,
        damage: p.damage,
        captures: p.captures,
        holdSeconds: p.holdSeconds,
        killScore: p.killScore,
        objectiveScore: p.objectiveScore,
        streakScore,
        totalScore: p.killScore + p.objectiveScore + streakScore,
        streaks,
        killed: p.killed.map((k) => ({ name: k.name, count: k.count })),
        killedBy: p.killedBy.map((k) => ({ name: k.name, count: k.count })),
        nemesis: nem,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore || b.frags - a.frags);
  return {
    version: CACHE_VERSION,
    roundNo,
    winnerTeam: round0?.winnerTeam ?? report.matchWinner ?? null,
    durationSeconds: round0?.durationSeconds ?? null,
    teams: report.teams.map((t) => ({ colour: t.colour, name: t.name, playerCount: t.playerNames.length })),
    players,
    builtAt: report.generatedAt,
  };
}

/** Count kill-streak awards by lower(name)+key across a set of parsed rounds. */
function crossKillCounts(rounds: Round[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const aw of detectCrossRoundKillStreaks(rounds)) {
    const k = `${nk(aw.name)}\u0000${aw.key}`;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export async function getInMatchScoreboard(
  svc: SupabaseClient,
  matchId: string,
  meta: { label: string; date: string | null },
  opts?: { excludeRoundNo?: number | null },
): Promise<InMatchScoreboard> {
  const { data: rows } = await svc
    .from("match_ingest_rounds")
    .select("id, round_no, filename, raw_file, resolutions, winner_override, report, report_built_at")
    .eq("match_id", matchId)
    .or("mode.eq.online,mode.is.null")
    .order("round_no", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  const exclude = opts?.excludeRoundNo ?? null;
  const list = ((rows ?? []) as RoundRow[]).filter((r) => exclude == null || r.round_no !== exclude);
  if (list.length === 0) return { label: meta.label, date: meta.date, rounds: [] };

  const needsBuild = list.some((r) => !(r.report && r.report_built_at && r.report.version === CACHE_VERSION));

  let identityByHeadband: ((no: number) => string) | undefined;
  const maps: BuildMaps = { streakImg: new Map(), streakCfg: {}, nameMeta: new Map(), gunImg: new Map() };
  const scoringRuntime = await getScoringConfig(svc);
  const killDeltaByIndex = new Map<number, KillDelta>();

  if (needsBuild) {
    const resolver = await resolveRoster(svc, matchId);
    identityByHeadband = (no: number) => {
      const e = resolver(String(no));
      return e.nickname === String(no) ? "" : e.nickname;
    };

    const [{ data: sdefs }, { data: parts }, { data: guns }] = await Promise.all([
      svc.from("streak_definitions").select("streak_key, name, badge_url, points"),
      svc.from("match_participants").select("account_id, display_name, gun_used, headset_label"),
      svc.from("guns").select("name, image_url"),
    ]);

    for (const d of (sdefs ?? []) as { streak_key: string | null; name: string | null; badge_url: string | null; points: number | null }[]) {
      const key = (d.streak_key ?? "").trim();
      if (!key) continue;
      maps.streakCfg[key] = { name: (d.name ?? key).trim() || key, points: Number(d.points) || 0 };
      maps.streakImg.set(key, (d.badge_url ?? "").trim());
    }

    const accIds = [...new Set(((parts ?? []) as { account_id: string | null }[]).map((p) => p.account_id).filter(Boolean) as string[])];
    const { data: accRows } = accIds.length
      ? await svc.from("accounts").select("id, ops_tag, profile_pic_url").in("id", accIds)
      : { data: [] as { id: string; ops_tag: string | null; profile_pic_url: string | null }[] };
    const accById = new Map(((accRows ?? []) as { id: string; ops_tag: string | null; profile_pic_url: string | null }[]).map((a) => [a.id, a]));
    for (const p of (parts ?? []) as { account_id: string | null; display_name: string | null; gun_used: string | null; headset_label: string | null }[]) {
      const acc = p.account_id ? accById.get(p.account_id) : undefined;
      const nickname = (acc?.ops_tag || p.display_name || "").trim();
      if (!nickname) continue;
      maps.nameMeta.set(nk(nickname), { avatarUrl: (acc?.profile_pic_url ?? "").trim(), gun: (p.gun_used ?? "").trim(), headband: (p.headset_label ?? "").trim() });
    }
    for (const g of (guns ?? []) as { name: string | null; image_url: string | null }[]) {
      if (g.name) maps.gunImg.set(g.name.trim(), (g.image_url ?? "").trim());
    }

    // Parse every round once (identity-remapped) and precompute, per round, the
    // kill-streak awards attributable to it: cumulative-through-N minus
    // cumulative-through-(N-1) over the stitched timeline.
    const parsedByIndex: (Round | null)[] = list.map((r) => {
      if (!r.raw_file) return null;
      const pr = parseRound(r.raw_file, { spawnWindowSeconds: 3 });
      for (const pl of pr.players) {
        if (pl.headband_no != null) {
          const nm = identityByHeadband!(pl.headband_no);
          if (nm) pl.name = nm;
        }
      }
      return pr;
    });
    const prefix: Round[] = [];
    let prevCounts = new Map<string, number>();
    for (let i = 0; i < list.length; i++) {
      const pr = parsedByIndex[i];
      if (pr) prefix.push(pr);
      const curCounts = crossKillCounts(prefix);
      const delta: KillDelta = new Map();
      for (const [k, cur] of curCounts) {
        const d = cur - (prevCounts.get(k) ?? 0);
        if (d <= 0) continue;
        const [name, key] = k.split("\u0000");
        let byKey = delta.get(name);
        if (!byKey) delta.set(name, (byKey = new Map()));
        byKey.set(key, (byKey.get(key) ?? 0) + d);
      }
      killDeltaByIndex.set(i, delta);
      prevCounts = curCounts;
    }
  }

  const rounds: InMatchRound[] = [];
  const freshlyBuilt: { id: string; round: InMatchRound }[] = [];
  let seq = 0;
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    seq += 1;
    const roundNo = r.round_no ?? seq;
    if (r.report && r.report_built_at && r.report.version === CACHE_VERSION) {
      rounds.push({ ...r.report, roundNo });
      continue;
    }
    if (!r.raw_file) continue;
    const report = buildMatchReportV2(
      [{ raw: r.raw_file, resolutions: r.resolutions ?? undefined, winnerOverride: r.winner_override ?? undefined }],
      { matchId, label: meta.label, date: meta.date },
      { identityByHeadband, streakConfig: maps.streakCfg, scoring: scoringRuntime.scoring, formula: scoringRuntime.formula },
    );
    const built = toInMatchRound(report, roundNo, maps, killDeltaByIndex.get(i) ?? new Map());
    rounds.push(built);
    freshlyBuilt.push({ id: r.id, round: built });
  }

  if (freshlyBuilt.length > 0) {
    const builtAt = new Date().toISOString();
    await Promise.all(
      freshlyBuilt.map((b) =>
        svc.from("match_ingest_rounds").update({ report: b.round, report_built_at: builtAt }).eq("id", b.id),
      ),
    );
  }

  return { label: meta.label, date: meta.date, rounds };
}

/** Invalidate cached reports for a match so the next read rebuilds them. */
export async function invalidateInMatchScoreboard(svc: SupabaseClient, matchId: string): Promise<void> {
  await svc
    .from("match_ingest_rounds")
    .update({ report: null, report_built_at: null })
    .eq("match_id", matchId)
    .or("mode.eq.online,mode.is.null");
}
