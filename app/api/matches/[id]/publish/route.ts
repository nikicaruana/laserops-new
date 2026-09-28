/**
 * app/api/matches/[id]/publish/route.ts
 * --------------------------------------------------------------------
 * Publish Scores (commit step). Verifies the caller is an admin with a 2FA
 * (aal2) session, checks every capture ambiguity is reviewed, computes the
 * per-player aggregates + accolade awards + XP from the ingested rounds, writes
 * them, and stamps the match as scored. Idempotent: re-publishing replaces the
 * match's aggregate + award rows.
 *
 * Two ingest modes (match_ingest_rounds.mode):
 *   - online: JSON event-stream rounds -> computeMatchCommit (full stats).
 *   - offline: one .lwa/CSV whole-match aggregate -> computeOfflineMatchCommit
 *     (killScore only; damage reconstructed from hits x per-gun damage; round
 *     winners are marshal-entered on matches.offline_round_results).
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseRound } from "@/lib/ingestion/round-parser";
import { unreviewedCount, type RoundResolutions } from "@/lib/ingestion/resolutions";
import { computeMatchCommit, type CommitResult } from "@/lib/ingestion/commit";
import { computeOfflineMatchCommit, type OfflinePlayerStat } from "@/lib/ingestion/offline-commit";
import { lwaMatchPlayers, isLwa } from "@/lib/ingestion/lwa";
import { parseXpConfig } from "@/lib/scoring/xp";
import { resolveRoster } from "@/lib/ingestion/roster";
import { recomputeProgression } from "@/lib/ingestion/progression";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Auth: signed-in admin with a 2FA-elevated (aal2) session.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return NextResponse.json({ error: "Two-factor authentication is required to publish scores." }, { status: 403 });

  // Load ingested rounds (raw file + mode).
  const { data: rows, error: rErr } = await supabase.from("match_ingest_rounds").select("raw_file, resolutions, mode, winner_override").eq("match_id", id).order("created_at");
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });
  const ingested = (rows ?? []).filter((r) => r.raw_file);
  if (ingested.length === 0) return NextResponse.json({ error: "No ingested rounds to publish." }, { status: 400 });
  // (offline vs online is the admin-chosen matches.scoring_mode, read below)

  // Config + roster shared by both paths.
  const { data: accs } = await supabase.from("accolade_definitions").select("id, name, xp").eq("scope", "match");
  const { data: xpCfg } = await supabase.from("xp_config").select("key, value");
  const cfg = parseXpConfig((xpCfg ?? []) as { key: string; value: number | null }[]);
  const accoladeByKey = new Map((accs ?? []).map((a) => [norm(a.name as string), { id: a.id as string, xp: (a.xp as number) ?? 0 }]));
  const { data: streakDefs } = await supabase.from("streak_definitions").select("streak_key, name, points").eq("is_active", true);
  const streakConfig = Object.fromEntries((streakDefs ?? []).map((sd) => [sd.streak_key as string, { name: sd.name as string, points: Number(sd.points) || 0 }]));
  const identity = await resolveRoster(supabase, id);

  // Match flags + date (date drives date-scoped gun damage for offline).
  const { data: mFlags } = await supabase.from("matches").select("played_on, scheduled_at, is_double_xp, offline_round_results, scoring_mode").eq("id", id).maybeSingle();
  const now = new Date().toISOString();
  const playedOn = (mFlags?.played_on as string | null) || ((mFlags?.scheduled_at as string | null)?.slice(0, 10)) || now.slice(0, 10);
  const isDoubleXp = mFlags?.is_double_xp === true;
  const isOffline = mFlags?.scoring_mode === "offline";

  let result: CommitResult;
  if (isOffline) {
    // Offline: one .lwa (or several) -> whole-match per-player aggregate.
    const onlineWinners: (string | null)[] = [];
    let hasLwa = false;
    // Kill counters from BOTH the .lwa AND any online JSON rounds (a match that
    // started online then switched) — every round scored kill-only.
    const players: OfflinePlayerStat[] = [];
    for (const r of ingested) {
      const raw = r.raw_file as string;
      if (isLwa(raw)) {
        hasLwa = true;
        try { players.push(...lwaMatchPlayers(raw)); } catch { /* skip bad file */ }
      } else {
        try {
          const round = parseRound(raw, { spawnWindowSeconds: 3 });
          const ov = (r.winner_override as string | null) ?? null;
          onlineWinners.push(ov === "draw" ? null : (ov || round.result.winner_team || null));
          for (const pl of round.players) {
            const c = round.final_player_counters[pl.in_game_player_id];
            if (!c) continue;
            players.push({ headband: pl.name, team: pl.team, frags: c.frags, deaths: c.deaths, hits: c.hits, shots: c.shots, wounds: c.wounds ?? 0, revivals: 0 });
          }
        } catch { /* skip unparseable */ }
      }
    }
    if (players.length === 0) return NextResponse.json({ error: "No players found in the ingested files." }, { status: 400 });
    // Online rounds first (JSON-derived/overridden winners), then the marshal-entered
    // offline rounds, numbered continuously across the whole match.
    const offlineWinners = ((mFlags?.offline_round_results ?? []) as (string | null)[]).map((c) => c || null);
    if (hasLwa && offlineWinners.length === 0) return NextResponse.json({ error: "Enter the round results for the offline rounds before publishing." }, { status: 400 });
    const roundResults = [...onlineWinners, ...offlineWinners].map((w) => ({ winnerColour: w }));
    // Resolve every gun's damage-per-hit at the game's date; Unknown Gun fallback.
    const { data: gd } = await supabase.rpc("all_gun_damage_at", { p_at: playedOn });
    const dmgMap = new Map(((gd ?? []) as { name: string; damage: number | null }[]).map((x) => [String(x.name).toLowerCase().trim(), Number(x.damage) || 0]));
    const unknownDmg = dmgMap.get("unknown gun") ?? 0;
    const gunDamage = (name: string | null | undefined) => (name ? dmgMap.get(name.toLowerCase().trim()) ?? unknownDmg : unknownDmg);
    result = computeOfflineMatchCommit(players, roundResults, identity, gunDamage, cfg, isDoubleXp);
  } else {
    // Online: JSON event-stream rounds.
    const rounds = ingested.filter((r) => !isLwa(r.raw_file as string)).map((r) => ({ raw: r.raw_file as string, resolutions: (r.resolutions ?? {}) as RoundResolutions, winnerOverride: (r.winner_override as string | null) ?? null }));
    if (rounds.length === 0) return NextResponse.json({ error: "No online (JSON) rounds to score. If this game was played offline, switch the match to Offline mode." }, { status: 400 });
    // Gate: every same-second capture ambiguity must be reviewed first.
    let unreviewed = 0;
    for (const rd of rounds) unreviewed += unreviewedCount(parseRound(rd.raw, { spawnWindowSeconds: 3 }), rd.resolutions);
    if (unreviewed > 0) return NextResponse.json({ error: `${unreviewed} unreviewed capture ambiguity${unreviewed === 1 ? "" : "ies"} — resolve them before publishing.` }, { status: 400 });
    result = computeMatchCommit(rounds, accoladeByKey, identity, cfg, isDoubleXp, streakConfig);
  }

  // Write via the service role (RLS-bypassing; grants added in migration).
  const svc = createServiceClient();
  if (!svc) return NextResponse.json({ error: "Server is not configured for writes (service role key missing)." }, { status: 500 });
  await svc.from("match_awards").delete().eq("match_id", id);
  await svc.from("match_player_aggregate").delete().eq("match_id", id);
  await svc.from("killstreak_deployments").delete().eq("match_id", id); // transient jams — not kept past the match

  const { error: aggErr } = await svc.from("match_player_aggregate").insert(result.aggregates.map((a) => ({ ...a, match_id: id })));
  if (aggErr) return NextResponse.json({ error: `Aggregate write failed: ${aggErr.message}` }, { status: 500 });

  if (result.awards.length) {
    const { error: awErr } = await svc.from("match_awards").insert(result.awards.map((a) => ({ ...a, match_id: id, awarded_at: now })));
    if (awErr) return NextResponse.json({ error: `Awards write failed: ${awErr.message}` }, { status: 500 });
  }

  // Squad-vs-squad / ladder matches: auto-derive each squad's team colour from
  // the committed per-player data (overwrite=false never clobbers a manual
  // admin choice) BEFORE stamping winning_team_colour below, so the ladder
  // auto-movement trigger can map the winning colour to a squad and move
  // positions with zero admin input. No-op for non-squad matches; non-fatal.
  try {
    await svc.rpc("derive_match_squad_colours", { p_match_id: id, p_overwrite: false });
  } catch {
    /* ladder colour derivation is a convenience, not core scoring */
  }

  // Stamp the match scored. Ensure played_on is set (needed for chronological
  // XP/level/ELO ordering + player history) — keep any existing date.
  const { error: mErr } = await svc.from("matches").update({
    status: "completed",
    winning_team_colour: result.winnerColour,
    net_result_summary: result.netResultSummary,
    round_count: result.roundCount,
    played_on: playedOn,
    xp_distributed_at: now,
  }).eq("id", id);
  if (mErr) return NextResponse.json({ error: `Match stamp failed: ${mErr.message}` }, { status: 500 });

  // Roll the match into careers: chronological XP/level/Elo back-fill across all
  // matches, then rebuild lifetime stats + grant level rewards + clear stale flags.
  try {
    await recomputeProgression(supabase, id);
  } catch (e) {
    return NextResponse.json({ error: `Scores saved, but the XP/Elo recompute failed: ${e instanceof Error ? e.message : "unknown error"}` }, { status: 500 });
  }
  const { error: rollupErr } = await supabase.rpc("rollup_match_careers");
  if (rollupErr) return NextResponse.json({ error: `Scores saved, but the career rollup failed: ${rollupErr.message}` }, { status: 500 });

  return NextResponse.json({ ok: true, players: result.aggregates.length, awards: result.awards.length, winner: result.winnerColour });
}
