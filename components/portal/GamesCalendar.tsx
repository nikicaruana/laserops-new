"use client";

/**
 * components/portal/GamesCalendar.tsx
 * --------------------------------------------------------------------
 * Month calendar of open games for players. Each day shows how many open games
 * are on it and whether the day is available for booking (from the admin booking
 * calendar). Closed days are shaded; clicking a day lists that day's games with
 * links to join. An alternative to the list view on the games page.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PlayerBar } from "@/components/portal/PlayerBar";
import { MatchStatusBadge } from "@/components/admin/MatchStatusBadge";

export type CalendarGame = {
  id: string;
  title: string;
  scheduledAt: string | null;
  status: string | null;
  registered: number;
  min: number;
  max: number | null;
  priceEur: number | null;
  pricingMode: string | null;
  isDoubleXP: boolean;
  isBeginner: boolean;
  beginnerMaxLevel: number | null;
};

type DayAvail = { the_date: string; is_open: boolean; open_time: string | null; close_time: string | null; note: string | null };

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function hhmm(t: string | null): string {
  return t ? t.slice(0, 5) : "";
}
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Joinable stages shown on the player calendar, in chip order + colours.
const STATUS_ORDER = ["confirmed", "awaiting_confirm", "tentative"];
const STATUS_META: Record<string, { chip: string; label: string }> = {
  confirmed: { chip: "bg-green-500 text-black", label: "Confirmed" },
  awaiting_confirm: { chip: "bg-amber-400 text-black", label: "Awaiting confirmation" },
  tentative: { chip: "bg-neutral-400 text-black", label: "Looking for players" },
};
function countByStatus(list: CalendarGame[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const g of list) if (g.status) c[g.status] = (c[g.status] ?? 0) + 1;
  return c;
}

export function GamesCalendar({ games }: { games: CalendarGame[] }) {
  const supabase = createClient();
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [avail, setAvail] = useState<Record<string, DayAvail>>({});
  const [selected, setSelected] = useState<string | null>(iso(today));

  // Games grouped by their local date.
  const byDate = useMemo(() => {
    const map: Record<string, CalendarGame[]> = {};
    for (const g of games) {
      if (!g.scheduledAt) continue;
      const key = iso(new Date(g.scheduledAt));
      (map[key] ??= []).push(g);
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
    return map;
  }, [games]);

  const first = new Date(cursor.y, cursor.m, 1);
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7;

  const loadMonth = useCallback(async () => {
    const from = iso(new Date(cursor.y, cursor.m, 1));
    const to = iso(new Date(cursor.y, cursor.m, daysInMonth));
    const { data } = await supabase.rpc("booking_calendar", { p_from: from, p_to: to });
    const map: Record<string, DayAvail> = {};
    for (const r of (data ?? []) as DayAvail[]) map[r.the_date] = r;
    setAvail(map);
  }, [cursor.y, cursor.m, daysInMonth, supabase]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  const monthLabel = first.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const todayKey = iso(today);
  const selectedGames = selected ? byDate[selected] ?? [] : [];
  const selDay = selected ? avail[selected] : null;
  const selLabel = selected ? new Date(selected + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : "";

  return (
    <div className="space-y-4">
      <div className="portal-card p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-bold text-text">{monthLabel}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))} className="border border-border-strong px-3 py-1 text-sm text-text-muted hover:border-accent hover:text-accent">←</button>
            <button type="button" onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))} className="border border-border-strong px-3 py-1 text-sm text-text-muted hover:border-accent hover:text-accent">→</button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((d) => (
            <div key={d} className="pb-1 text-[0.55rem] font-bold uppercase tracking-[0.12em] text-text-subtle">{d}</div>
          ))}
          {Array.from({ length: leading }).map((_, i) => <div key={`b${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const key = iso(new Date(cursor.y, cursor.m, dayNum));
            const dayGames = byDate[key] ?? [];
            const counts = countByStatus(dayGames);
            const open = avail[key]?.is_open ?? true;
            const isSel = selected === key;
            const isToday = key === todayKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={`flex min-h-[3.4rem] flex-col items-center justify-start gap-1 border p-1 transition-colors ${
                  isSel ? "border-accent" : "border-border hover:border-border-strong"
                } ${open ? "bg-bg" : "bg-bg-overlay/40"}`}
              >
                <span className={`text-xs font-bold ${isToday ? "text-accent" : open ? "text-text" : "text-text-subtle"}`}>{dayNum}</span>
                {dayGames.length > 0 ? (
                  <span className="flex flex-wrap justify-center gap-0.5">
                    {STATUS_ORDER.map((st) =>
                      counts[st] ? (
                        <span key={st} className={`min-w-[0.85rem] rounded-sm px-0.5 text-center text-[0.5rem] font-bold ${STATUS_META[st].chip}`} title={`${counts[st]} ${STATUS_META[st].label}`}>
                          {counts[st]}
                        </span>
                      ) : null,
                    )}
                  </span>
                ) : !open ? (
                  <span className="text-[0.45rem] uppercase text-text-subtle">closed</span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {STATUS_ORDER.map((st) => (
            <span key={st} className="flex items-center gap-1.5 text-[0.6rem] text-text-muted">
              <span className={`h-3 w-3 rounded-sm ${STATUS_META[st].chip}`} />
              {STATUS_META[st].label}
            </span>
          ))}
        </div>
      </div>

      {/* Selected-day detail */}
      {selected && (
        <div className="portal-card p-4 sm:p-5">
          <p className="text-sm font-bold text-text">{selLabel}</p>
          {selDay && !selDay.is_open && (
            <p className="mt-1 text-xs text-text-subtle">Closed for booking{selDay.note ? ` · ${selDay.note}` : ""}.</p>
          )}
          {selDay && selDay.is_open && (
            <p className="mt-1 text-xs text-text-subtle">
              Open{selDay.open_time ? ` ${hhmm(selDay.open_time)}–${hhmm(selDay.close_time)}` : ""}.
            </p>
          )}
          {selectedGames.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">No open games on this day.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {selectedGames.map((g) => {
                const time = g.scheduledAt ? new Date(g.scheduledAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";
                const showPrice = g.priceEur != null && g.pricingMode === "per_player";
                return (
                  <li key={g.id}>
                    <Link href={`/player-portal/games/${g.id}`} className="flex flex-col gap-3 border border-border bg-bg p-4 transition-colors hover:border-accent">
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-text">{g.title}</span>
                          <span className="mt-0.5 block text-xs text-text-muted">
                            {time}
                            {showPrice ? ` · €${Number(g.priceEur).toFixed(2)}/player` : ""}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <MatchStatusBadge status={g.status} />
                          {g.isDoubleXP && (
                            <span className="border border-amber-700 bg-amber-950/40 px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-[0.12em] text-amber-300">2XP</span>
                          )}
                          {g.isBeginner && (
                            <span className="border border-emerald-700 bg-emerald-950/40 px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-[0.12em] text-emerald-300">
                              Beginners{g.beginnerMaxLevel != null ? ` · max Lvl ${g.beginnerMaxLevel}` : ""}
                            </span>
                          )}
                        </span>
                      </div>
                      <PlayerBar reg={g.registered} min={g.min} max={g.max} status={g.status} />
                      <span className="self-end text-[0.7rem] font-bold uppercase tracking-[0.12em] text-accent">View →</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
