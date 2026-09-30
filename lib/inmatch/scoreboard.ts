/**
 * lib/inmatch/scoreboard.ts
 * --------------------------------------------------------------------
 * In-match round scores (Beta). Builds a compact per-round scoreboard for the
 * player-facing in-match view — the leaderboard + everyone's performance +
 * streaks + head-to-head that players see BETWEEN rounds while an online game is
 * running without the live feed.
 *
 * Each round's scoreboard is derived with the SAME v2 scoring engine as the
 * published match report ([[match-report-v2-beta]]), but on a single round's raw
 * JSON, then cached on match_ingest_rounds.report so player reads are instant
 * (the break between rounds is short — nothing re-parses on the read path once
 * a round is cached). Server-only: reads via the service client (it must read
 * every player's account for identities/avatars, every gun's art, and every
 * round's raw file).
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMatchReportV2, type MatchReportV2 } from "@/lib/match-report-v2/build";
import { resolveRoster } from "@/lib/ingestion/roster";
import type { RoundResolutions } from "@/lib/ingestion/resolutions";

// Bump when the cached payload shape changes so stale caches rebuild.
const CACHE_VERSION = 3;

export type InMatchStreak = { key: string; name: string; count: number; points: number; imageUrl: string };
export type InMatchKill = { name: string; count: number };
export type InMatchNemesis = { name: string; killsFor: number; killsAgainst: number; avatarUrl: string } | null;

export type InMatchPlayer = {
  name: string;
  team: string;
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

type NameMeta = { avatarUrl: string; gun: string };
type BuildMaps = {
  streakImg: Map<string, string>;
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

/** MatchReportV2 (built on ONE round) -> compact in-match payload. */
function toInMatchRound(report: MatchReportV2, roundNo: number, maps: BuildMaps): InMatchRound {
  const round0 = report.rounds[0];
  const players: InMatchPlayer[] = report.players
    .map((p) => {
      const meta = maps.nameMeta.get(nk(p.name));
      const gunLabel = meta?.gun ?? "";
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
        streakScore: p.streakScore,
        totalScore: p.totalScore,
        streaks: p.streaks.map((s) => ({
          key: s.key,
          name: s.name,
          count: s.count,
          points: s.points,
          imageUrl: maps.streakImg.get(s.key) ?? "",
        })),
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

/**
 * Build the in-match scoreboard for a match. Cached rounds are returned as-is;
 * any round without a current cached report is built now and the cache written
 * back so the next read is an instant cache hit.
 */
export async function getInMatchScoreboard(
  svc: SupabaseClient,
  matchId: string,
  meta: { label: string; date: string | null },
): Promise<InMatchScoreboard> {
  const { data: rows } = await svc
    .from("match_ingest_rounds")
    .select("id, round_no, filename, raw_file, resolutions, winner_override, report, report_built_at")
    .eq("match_id", matchId)
    .eq("mode", "online")
    .order("round_no", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  const list = (rows ?? []) as RoundRow[];
  if (list.length === 0) return { label: meta.label, date: meta.date, rounds: [] };

  const needsBuild = list.some((r) => !(r.report && r.report_built_at && r.report.version === CACHE_VERSION));

  let identityByHeadband: ((no: number) => string) | undefined;
  let streakConfig: Record<string, { name: string; points: number }> | undefined;
  const maps: BuildMaps = { streakImg: new Map(), nameMeta: new Map(), gunImg: new Map() };

  if (needsBuild) {
    const resolver = await resolveRoster(svc, matchId);
    identityByHeadband = (no: number) => {
      const e = resolver(String(no));
      return e.nickname === String(no) ? "" : e.nickname;
    };

    const [{ data: sdefs }, { data: parts }, { data: guns }] = await Promise.all([
      svc.from("streak_definitions").select("streak_key, name, badge_url, points"),
      svc.from("match_participants").select("account_id, display_name, gun_used"),
      svc.from("guns").select("name, image_url"),
    ]);

    // Admin streak definitions are authoritative for names + points + badges,
    // keyed by the canonical streak_key (matches the report's streak.key).
    streakConfig = {};
    for (const d of (sdefs ?? []) as { streak_key: string | null; name: string | null; badge_url: string | null; points: number | null }[]) {
      const key = (d.streak_key ?? "").trim();
      if (!key) continue;
      streakConfig[key] = { name: (d.name ?? key).trim() || key, points: Number(d.points) || 0 };
      maps.streakImg.set(key, (d.badge_url ?? "").trim());
    }

    // name -> avatar + gun (avatars only resolve for accounts we can read)
    const accIds = [...new Set(((parts ?? []) as { account_id: string | null }[]).map((p) => p.account_id).filter(Boolean) as string[])];
    const { data: accRows } = accIds.length
      ? await svc.from("accounts").select("id, ops_tag, profile_pic_url").in("id", accIds)
      : { data: [] as { id: string; ops_tag: string | null; profile_pic_url: string | null }[] };
    const accById = new Map(((accRows ?? []) as { id: string; ops_tag: string | null; profile_pic_url: string | null }[]).map((a) => [a.id, a]));
    for (const p of (parts ?? []) as { account_id: string | null; display_name: string | null; gun_used: string | null }[]) {
      const acc = p.account_id ? accById.get(p.account_id) : undefined;
      const nickname = (acc?.ops_tag || p.display_name || "").trim();
      if (!nickname) continue;
      maps.nameMeta.set(nk(nickname), { avatarUrl: (acc?.profile_pic_url ?? "").trim(), gun: (p.gun_used ?? "").trim() });
    }

    for (const g of (guns ?? []) as { name: string | null; image_url: string | null }[]) {
      if (g.name) maps.gunImg.set(g.name.trim(), (g.image_url ?? "").trim());
    }
  }

  const rounds: InMatchRound[] = [];
  const freshlyBuilt: { id: string; round: InMatchRound }[] = [];
  let seq = 0;
  for (const r of list) {
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
      { identityByHeadband, streakConfig },
    );
    const built = toInMatchRound(report, roundNo, maps);
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
    .eq("mode", "online");
}
