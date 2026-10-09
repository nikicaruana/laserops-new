/**
 * lib/cms/open-games.ts
 * --------------------------------------------------------------------
 * The public /events/open-games schedule, sourced from SUPABASE (the game
 * portal's open games) - not the old Google Sheets CMS. Lists upcoming public
 * open games (nearest first) followed by recent completed public games (each
 * linking to its match report). Private bookings are never listed.
 *
 * Read with the cookieless public (anon) client so the page stays static/ISR;
 * matches are anon-readable for non-private games via RLS.
 */
import { createPublicClient } from "@/lib/supabase/public";

/** Typed shape consumed by the page + OpenGamesTable (kept stable from the old CMS). */
export type OpenGame = {
  /** YYYY-MM-DD (Malta) */
  date: string;
  /** HH:MM (24-hour, Malta), or "" */
  time: string;
  /** "Open Match" or "Double XP" */
  type: string;
  /** True for a Double XP game (controls the row highlight). */
  isDoubleXP: boolean;
  /** In-app game page to sign up, or "" for completed games. */
  signupLink: string;
  /** "Open" | "Completed". */
  status: string;
  /** Public match report URL once played, or "". */
  matchReportLink: string;
  /** Unused now (kept for the OpenGamesTable prop shape). */
  moreInfoImage: string;
  /** Unused now (kept for the OpenGamesTable prop shape). */
  moreInfoText: string;
};

type MatchRow = {
  id: string;
  match_code: string | null;
  status: string | null;
  scheduled_at: string | null;
  played_on: string | null;
  is_double_xp: boolean | null;
};

const MALTA = "Europe/Malta";

/** Malta-local YYYY-MM-DD + HH:MM from a timestamptz (empty strings if unparseable). */
function parts(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  return {
    date: d.toLocaleDateString("en-CA", { timeZone: MALTA }),
    time: d.toLocaleTimeString("en-GB", { timeZone: MALTA, hour: "2-digit", minute: "2-digit", hour12: false }),
  };
}

const SELECT = "id, match_code, status, scheduled_at, played_on, is_double_xp";

/**
 * Fetch the public open-games schedule from Supabase. Returns an empty array on
 * any error so the page shows a graceful empty state rather than throwing.
 */
export async function fetchOpenGames(): Promise<OpenGame[]> {
  const supabase = createPublicClient();
  const nowIso = new Date().toISOString();

  const [upRes, doneRes] = await Promise.all([
    supabase
      .from("matches")
      .select(SELECT)
      .eq("is_private", false)
      .in("status", ["tentative", "awaiting_confirm", "confirmed", "live"])
      .gte("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("matches")
      .select(SELECT)
      .eq("is_private", false)
      .eq("status", "completed")
      .order("played_on", { ascending: false, nullsFirst: false })
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .limit(12),
  ]);

  if (upRes.error) console.warn("[open-games] upcoming fetch failed:", upRes.error.message);
  if (doneRes.error) console.warn("[open-games] completed fetch failed:", doneRes.error.message);

  const upcoming: OpenGame[] = ((upRes.data ?? []) as MatchRow[])
    .map((m): OpenGame => {
      const { date, time } = parts(m.scheduled_at);
      return {
        date,
        time,
        type: m.is_double_xp ? "Double XP" : "Open Match",
        isDoubleXP: Boolean(m.is_double_xp),
        signupLink: `/player-portal/games/${m.id}`,
        status: "Open",
        matchReportLink: "",
        moreInfoImage: "",
        moreInfoText: "",
      };
    })
    .filter((g) => g.date !== "");

  const completed: OpenGame[] = ((doneRes.data ?? []) as MatchRow[])
    .map((m): OpenGame => {
      let p = parts(m.scheduled_at);
      if (!p.date && m.played_on) p = { date: parts(`${m.played_on}T12:00:00Z`).date, time: "" };
      return {
        date: p.date,
        time: p.time,
        type: m.is_double_xp ? "Double XP" : "Open Match",
        isDoubleXP: Boolean(m.is_double_xp),
        signupLink: "",
        status: "Completed",
        matchReportLink: m.match_code ? `/match-report?match=${encodeURIComponent(m.match_code)}` : "",
        moreInfoImage: "",
        moreInfoText: "",
      };
    })
    .filter((g) => g.date !== "");

  return [...upcoming, ...completed];
}

/** Format a YYYY-MM-DD date for display, e.g. "15 Jun 2026" (defensive passthrough). */
export function formatGameDate(yyyyMmDd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return yyyyMmDd;
  const d = new Date(yyyyMmDd + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return yyyyMmDd;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
