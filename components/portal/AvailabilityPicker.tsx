"use client";

/**
 * components/portal/AvailabilityPicker.tsx
 * --------------------------------------------------------------------
 * Calendar date + time picker driven by the admin booking availability
 * (booking_calendar RPC). Closed days and past days are disabled; picking an
 * open day reveals the start-time slots for that day - only slots where the full
 * session (sessionHours) finishes by that day's closing time, and (for today)
 * that haven't already passed. Used on the booking screens so players can only
 * pick times we actually take bookings for.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type DayAvail = { the_date: string; is_open: boolean; open_time: string | null; close_time: string | null; note: string | null };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toMin(hhmm: string): number {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}
function fmtMin(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function AvailabilityPicker({
  value,
  onChange,
  sessionHours = 3,
  slotMinutes = 30,
}: {
  value: { date: string; time: string };
  onChange: (date: string, time: string) => void;
  sessionHours?: number;
  slotMinutes?: number;
}) {
  const supabase = createClient();
  const today = new Date();
  const todayIso = iso(today);
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [avail, setAvail] = useState<Record<string, DayAvail>>({});
  const [busy, setBusy] = useState<{ start: number; end: number }[]>([]);

  const first = new Date(cursor.y, cursor.m, 1);
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7;
  const monthLabel = first.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const load = useCallback(async () => {
    const from = iso(new Date(cursor.y, cursor.m, 1));
    const to = iso(new Date(cursor.y, cursor.m, daysInMonth));
    const [{ data }, { data: busyRows }] = await Promise.all([
      supabase.rpc("booking_calendar", { p_from: from, p_to: to }),
      supabase.rpc("busy_slots", { p_from: from, p_to: to }),
    ]);
    const map: Record<string, DayAvail> = {};
    for (const r of (data ?? []) as DayAvail[]) map[r.the_date] = r;
    setAvail(map);
    setBusy(((busyRows ?? []) as { starts_at: string; ends_at: string }[]).map((b) => ({ start: new Date(b.starts_at).getTime(), end: new Date(b.ends_at).getTime() })));
  }, [cursor.y, cursor.m, daysInMonth, supabase]);

  useEffect(() => { load(); }, [load]);

  // Slots for the selected day.
  const slots = useMemo(() => {
    if (!value.date) return [];
    const day = avail[value.date];
    if (day && !day.is_open) return [];
    const openMin = toMin(day?.open_time ?? "09:00");
    const closeMin = toMin(day?.close_time ?? "22:00");
    const latest = closeMin - sessionHours * 60;
    let out: string[] = [];
    for (let m = openMin; m <= latest; m += slotMinutes) out.push(fmtMin(m));
    if (value.date === todayIso) {
      const nowMin = today.getHours() * 60 + today.getMinutes();
      out = out.filter((s) => toMin(s) > nowMin);
    }
    // Drop slots that clash with a confirmed/live game (1h buffer, 3h session).
    const bufferMs = 60 * 60 * 1000;
    const sessionMs = sessionHours * 3600 * 1000;
    return out.filter((t) => {
      const cs = new Date(`${value.date}T${t}:00`).getTime();
      const ce = cs + sessionMs;
      return !busy.some((b) => cs < b.end + bufferMs && b.start < ce + bufferMs);
    });
  }, [value.date, avail, busy, sessionHours, slotMinutes, todayIso, today]);

  const selDay = value.date ? avail[value.date] : null;
  const dayClosed = Boolean(value.date && selDay && !selDay.is_open);

  function pickDay(key: string, selectable: boolean) {
    if (!selectable) return;
    onChange(key, ""); // reset time on new day
  }

  return (
    <div className="space-y-4">
      <div className="border border-border-strong bg-bg p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-bold text-text">{monthLabel}</span>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Previous month" onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))} className="shrink-0 border border-border-strong px-3 py-1 text-sm text-text-muted hover:border-accent hover:text-accent">←</button>
            <button type="button" aria-label="Next month" onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))} className="shrink-0 border border-border-strong px-3 py-1 text-sm text-text-muted hover:border-accent hover:text-accent">→</button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((d) => (
            <div key={d} className="pb-1 text-[0.55rem] font-bold uppercase tracking-[0.1em] text-text-subtle">{d}</div>
          ))}
          {Array.from({ length: leading }).map((_, i) => <div key={`b${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const key = iso(new Date(cursor.y, cursor.m, dayNum));
            const open = avail[key]?.is_open ?? true;
            const past = key < todayIso;
            const selectable = open && !past;
            const isSel = value.date === key;
            return (
              <button
                key={key}
                type="button"
                disabled={!selectable}
                onClick={() => pickDay(key, selectable)}
                className={`flex h-10 items-center justify-center border text-xs font-bold transition-colors ${
                  isSel ? "border-accent bg-accent text-bg"
                    : selectable ? "border-border bg-bg text-text hover:border-accent"
                    : "cursor-not-allowed border-border/50 bg-bg-overlay/30 text-text-subtle/40"
                }`}
              >
                {dayNum}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[0.6rem] text-text-subtle">Greyed-out days are closed or in the past.</p>
      </div>

      {value.date && (
        <div>
          <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted">Start time</p>
          {dayClosed ? (
            <p className="border border-dashed border-border px-3 py-3 text-sm text-text-subtle">We are closed on this day{selDay?.note ? ` (${selDay.note})` : ""}. Pick another.</p>
          ) : slots.length === 0 ? (
            <p className="border border-dashed border-border px-3 py-3 text-sm text-text-subtle">No start times left for this day - try another.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onChange(value.date, t)}
                  className={`border px-3 py-1.5 text-sm font-semibold tabular-nums transition-colors ${
                    value.time === t ? "border-accent bg-accent text-bg" : "border-border-strong text-text hover:border-accent hover:text-accent"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
