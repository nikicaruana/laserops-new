/**
 * lib/booking/open-games.ts
 * --------------------------------------------------------------------
 * Upcoming public open games for the marketing booking page. Read anon via the
 * cookieless public client (matches is anon-readable), so /booking can stay
 * static / ISR. Shows the real games the portal lists, minus private games,
 * past games, and dev test matches. Never throws – returns [] on failure.
 */
import { createPublicClient } from "@/lib/supabase/public";

export type OpenGameTeaser = {
  id: string;
  title: string;
  scheduledAt: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  priceEur: number | null;
  registeredCount: number;
  isBeginner: boolean;
  beginnerMaxLevel: number | null;
  isDoubleXp: boolean;
};

export async function getUpcomingOpenGames(limit = 6): Promise<OpenGameTeaser[]> {
  try {
    const sb = createPublicClient();
    const nowIso = new Date().toISOString();
    const { data } = await sb
      .from("matches")
      .select(
        "id, match_code, title, status, scheduled_at, min_players, max_players, price_eur, registered_count, is_private, is_beginner, beginner_max_level, is_double_xp",
      )
      .eq("is_private", false)
      .in("status", ["tentative", "awaiting_confirm", "confirmed"])
      .gte("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true })
      .limit(limit + 6);
    if (!data) return [];
    return data
      // Hide dev/test seed matches from the public page.
      .filter((m) => !String(m.match_code ?? "").toUpperCase().startsWith("LO-TEST"))
      .slice(0, limit)
      .map((m) => ({
        id: m.id as string,
        title: (m.title as string)?.trim() || "Open Game",
        scheduledAt: (m.scheduled_at as string) ?? null,
        minPlayers: m.min_players == null ? null : Number(m.min_players),
        maxPlayers: m.max_players == null ? null : Number(m.max_players),
        priceEur: m.price_eur == null ? null : Number(m.price_eur),
        registeredCount: Number(m.registered_count) || 0,
        isBeginner: Boolean(m.is_beginner),
        beginnerMaxLevel: m.beginner_max_level == null ? null : Number(m.beginner_max_level),
        isDoubleXp: Boolean(m.is_double_xp),
      }));
  } catch {
    return [];
  }
}
