"use client";

/**
 * components/admin/BookingCalendarManager.tsx
 * --------------------------------------------------------------------
 * The booking availability master calendar. Admins control when games can be
 * booked:
 *   - Default times: the weekly template for any date NOT inside a season.
 *   - Seasons: named periods that recur every year between a start and end date
 *     (month/day; a range may wrap the new year), each overriding the default
 *     with its own weekly template. Shown as accordion cards.
 *   - Weekly hours: by default one window applied to every day of the week, with
 *     an option to customize individual days. A game must finish by the end time
 *     (a ~3h session), so the latest start is 3h before it.
 *   - Month grid: each day resolved from its override or the active season / the
 *     default template; click a day to override (closed / custom hours) or reset.
 *   - Blackout a whole range (e.g. away dates) - this still beats seasons + default.
 * All writes go through the booking_* RPCs (admin-gated); times are Europe/Malta.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

type Season = {
  id: string;
  name: string;
  start_month: number | null;
  start_day: number | null;
  end_month: number | null;
  end_day: number | null;
  is_default: boolean;
};
type Weekly = { season_id: string; weekday: number; is_open: boolean; open_time: string; close_time: string };
type DayCell = { the_date: string; is_open: boolean; open_time: string | null; close_time: string | null; note: string | null; is_override: boolean };
type Booking = { id: string; title: string | null; status: string | null; scheduled_at: string | null; is_private: boolean | null };
type Organizer = { match_id: string; full_name: string | null; ops_tag: string | null; phone_e164: string | null };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun for display

const STATUS_ORDER = ["live", "confirmed", "awaiting_confirm", "tentative", "completed", "cancelled"];
const STATUS_META: Record<string, { chip: string; label: string }> = {
  live: { chip: "bg-purple-500 text-white", label: "Live" },
  confirmed: { chip: "bg-green-500 text-black", label: "Confirmed" },
  awaiting_confirm: { chip: "bg-amber-400 text-black", label: "Awaiting confirmation" },
  tentative: { chip: "bg-neutral-400 text-black", label: "Gathering players" },
  completed: { chip: "bg-sky-500 text-black", label: "Completed" },
  cancelled: { chip: "bg-red-500 text-white", label: "Cancelled" },
};
function countByStatus(list: Booking[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const b of list) if (b.status) c[b.status] = (c[b.status] ?? 0) + 1;
  return c;
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function hhmm(t: string | null): string {
  return t ? t.slice(0, 5) : "";
}
function rangeLabel(s: Season): string {
  if (s.start_month == null || s.end_month == null) return "No dates set";
  return `${s.start_day} ${MONTHS[s.start_month - 1]} – ${s.end_day} ${MONTHS[s.end_month - 1]}`;
}
/** A one-line summary of a season's weekly hours. */
function weekSummary(rows: Weekly[]): string {
  const u = computeUniform(rows);
  if (u.uniform) return u.isOpen ? `Every day ${u.open}–${u.close}` : "Closed every day";
  const openCount = rows.filter((r) => r.is_open).length;
  return `Custom · ${openCount}/7 days open`;
}
function computeUniform(rows: Weekly[]): { uniform: boolean; isOpen: boolean; open: string; close: string } {
  const first = rows[0];
  if (!first) return { uniform: true, isOpen: true, open: "09:00", close: "22:00" };
  const sameOpenState = rows.every((r) => r.is_open === first.is_open);
  if (!sameOpenState) return { uniform: false, isOpen: true, open: "09:00", close: "22:00" };
  if (!first.is_open) return { uniform: true, isOpen: false, open: "09:00", close: "22:00" };
  const sameTimes = rows.every((r) => hhmm(r.open_time) === hhmm(first.open_time) && hhmm(r.close_time) === hhmm(first.close_time));
  return { uniform: sameTimes, isOpen: true, open: hhmm(first.open_time), close: hhmm(first.close_time) };
}

export function BookingCalendarManager({ initialSeasons, initialWeekly }: { initialSeasons: Season[]; initialWeekly: Weekly[] }) {
  const supabase = createClient();
  const today = new Date();

  const [seasons, setSeasons] = useState<Season[]>(initialSeasons);
  const [weeklyAll, setWeeklyAll] = useState<Weekly[]>(initialWeekly);
  const defaultSeason = seasons.find((s) => s.is_default) ?? null;
  const datedSeasons = seasons
    .filter((s) => !s.is_default)
    .sort((a, b) => (a.start_month ?? 99) - (b.start_month ?? 99) || (a.start_day ?? 99) - (b.start_day ?? 99));
  const [openCards, setOpenCards] = useState<Set<string>>(() => new Set(defaultSeason ? [defaultSeason.id] : []));

  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [days, setDays] = useState<Record<string, DayCell>>({});
  const [bookings, setBookings] = useState<Record<string, Booking[]>>({});
  const [organizers, setOrganizers] = useState<Record<string, Organizer>>({});
  const [conflicts, setConflicts] = useState<Booking[]>([]);
  const [selDate, setSelDate] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [rangeNote, setRangeNote] = useState("");

  const first = new Date(cursor.y, cursor.m, 1);
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7;

  function weekFor(seasonId: string): Weekly[] {
    return [0, 1, 2, 3, 4, 5, 6].map(
      (wd) => weeklyAll.find((w) => w.season_id === seasonId && w.weekday === wd) ?? { season_id: seasonId, weekday: wd, is_open: true, open_time: "09:00", close_time: "22:00" },
    );
  }
  function sig(seasonId: string): string {
    return seasonId + ":" + weekFor(seasonId).map((w) => `${w.is_open ? 1 : 0}${hhmm(w.open_time)}${hhmm(w.close_time)}`).join(",");
  }
  function toggleCard(id: string) {
    setOpenCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const loadMonth = useCallback(async () => {
    const from = iso(new Date(cursor.y, cursor.m, 1));
    const to = iso(new Date(cursor.y, cursor.m, daysInMonth));
    const fromTs = new Date(cursor.y, cursor.m, 1, 0, 0, 0).toISOString();
    const toTs = new Date(cursor.y, cursor.m, daysInMonth, 23, 59, 59).toISOString();
    const [{ data: availRows }, { data: matchRows }] = await Promise.all([
      supabase.rpc("booking_calendar", { p_from: from, p_to: to }),
      supabase.from("matches").select("id, title, status, scheduled_at, is_private").not("scheduled_at", "is", null).gte("scheduled_at", fromTs).lte("scheduled_at", toTs),
    ]);
    const map: Record<string, DayCell> = {};
    for (const r of (availRows ?? []) as DayCell[]) map[r.the_date] = r;
    setDays(map);
    const bmap: Record<string, Booking[]> = {};
    for (const b of (matchRows ?? []) as Booking[]) {
      if (!b.scheduled_at) continue;
      const key = iso(new Date(b.scheduled_at));
      (bmap[key] ??= []).push(b);
    }
    for (const k of Object.keys(bmap)) bmap[k].sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));
    setBookings(bmap);
    const ids = (matchRows ?? []).map((r) => (r as Booking).id);
    if (ids.length) {
      const { data: orgs } = await supabase.rpc("match_organizers", { p_match_ids: ids });
      setOrganizers((prev) => {
        const next = { ...prev };
        for (const o of (orgs ?? []) as Organizer[]) next[o.match_id] = o;
        return next;
      });
    }
  }, [cursor.y, cursor.m, daysInMonth, supabase]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  const loadConfig = useCallback(async () => {
    const [{ data: s }, { data: w }] = await Promise.all([
      supabase.from("booking_seasons").select("id, name, start_month, start_day, end_month, end_day, is_default").order("is_default", { ascending: false }).order("start_month").order("start_day"),
      supabase.from("booking_weekly_hours").select("season_id, weekday, is_open, open_time, close_time"),
    ]);
    setSeasons((s ?? []) as Season[]);
    setWeeklyAll((w ?? []) as Weekly[]);
  }, [supabase]);

  async function rpc(fn: string, args: Record<string, unknown>, okMsg: string, reloadCfg = false) {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) return setMsg(error.message);
    setMsg(okMsg);
    await loadMonth();
    if (reloadCfg) await loadConfig();
  }

  async function resolveReschedule(matchId: string, isoWhen: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newScheduledAt: isoWhen }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Couldn't reschedule.");
    } catch (err) {
      setBusy(false);
      return setMsg(err instanceof Error ? err.message : "Couldn't reschedule.");
    }
    setBusy(false);
    setConflicts((c) => c.filter((b) => b.id !== matchId));
    setMsg("Game moved.");
    await loadMonth();
  }

  async function resolveCancel(matchId: string) {
    if (!window.confirm("Cancel this game? Any paid players are refunded automatically.")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/cancel`, { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Couldn't cancel.");
    } catch (err) {
      setBusy(false);
      return setMsg(err instanceof Error ? err.message : "Couldn't cancel.");
    }
    setBusy(false);
    setConflicts((c) => c.filter((b) => b.id !== matchId));
    setMsg("Game cancelled.");
    await loadMonth();
  }

  async function blockRange() {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("block_booking_range", { p_from: rangeFrom, p_to: rangeTo, p_note: rangeNote });
    if (error) {
      setBusy(false);
      return setMsg(error.message);
    }
    const fromTs = new Date(rangeFrom + "T00:00:00").toISOString();
    const toTs = new Date(rangeTo + "T23:59:59").toISOString();
    const { data: rows } = await supabase
      .from("matches")
      .select("id, title, status, scheduled_at, is_private")
      .in("status", ["tentative", "awaiting_confirm", "confirmed"])
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", fromTs)
      .lte("scheduled_at", toTs);
    const affected = ((rows ?? []) as Booking[]).sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));
    setConflicts(affected);
    if (affected.length) {
      const { data: orgs } = await supabase.rpc("match_organizers", { p_match_ids: affected.map((a) => a.id) });
      setOrganizers((prev) => {
        const next = { ...prev };
        for (const o of (orgs ?? []) as Organizer[]) next[o.match_id] = o;
        return next;
      });
    }
    setBusy(false);
    setMsg(affected.length ? `Range blacked out. ${affected.length} game(s) fall in it - resolve each in the Games affected panel.` : "Range blacked out.");
    await loadMonth();
  }

  async function closeDay(open: string | null, close: string | null, note: string | null, isOpen: boolean) {
    await rpc("set_booking_override", { p_date: selDate, p_is_open: isOpen, p_open: open, p_close: close, p_note: note }, isOpen ? "Day updated." : "Day closed.");
    if (!isOpen && selDate) {
      const affected = (bookings[selDate] ?? []).filter((b) => ["tentative", "awaiting_confirm", "confirmed"].includes(b.status ?? ""));
      setConflicts(affected);
      if (affected.length) setMsg(`Day closed. ${affected.length} game(s) fall on it - resolve each in the Games affected panel.`);
    }
  }

  async function addSeason() {
    setBusy(true);
    setMsg(null);
    const m = today.getMonth() + 1;
    const d = today.getDate();
    const { data, error } = await supabase.rpc("upsert_booking_season", { p_id: null, p_name: "New season", p_start_month: m, p_start_day: d, p_end_month: m, p_end_day: d });
    setBusy(false);
    if (error) return setMsg(error.message);
    await loadConfig();
    if (typeof data === "string") setOpenCards((prev) => new Set(prev).add(data));
    setMsg("Season added - set its dates and hours.");
  }

  const monthLabel = first.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const sel = selDate ? days[selDate] : null;

  return (
    <div className="flex flex-col gap-8">
      {/* Seasons & opening hours */}
      <section className="order-3 border border-border bg-bg-elevated p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-accent">Seasons &amp; opening hours</h2>
          <Button type="button" size="sm" variant="secondary" onClick={addSeason} disabled={busy}>Add season</Button>
        </div>
        <p className="mb-4 text-xs text-text-muted">
          Default times apply to any date not inside a season. Seasons recur every year between their start and end dates and override the default. A blackout or a single-day override (set on the calendar below) still beats both.
        </p>
        <div className="flex flex-col gap-2">
          {defaultSeason && (
            <AccordionCard
              open={openCards.has(defaultSeason.id)}
              onToggle={() => toggleCard(defaultSeason.id)}
              title="Default times"
              subtitle="All dates not covered by a season"
              summary={weekSummary(weekFor(defaultSeason.id))}
            >
              <SeasonHours key={sig(defaultSeason.id)} seasonId={defaultSeason.id} weekly={weekFor(defaultSeason.id)} busy={busy} setBusy={setBusy} onSaved={loadConfig} supabase={supabase} />
            </AccordionCard>
          )}

          {datedSeasons.map((s) => (
            <AccordionCard
              key={s.id}
              open={openCards.has(s.id)}
              onToggle={() => toggleCard(s.id)}
              title={s.name}
              subtitle={rangeLabel(s)}
              summary={weekSummary(weekFor(s.id))}
            >
              <SeasonDates
                season={s}
                busy={busy}
                onSave={(name, sm, sd, em, ed) => rpc("upsert_booking_season", { p_id: s.id, p_name: name, p_start_month: sm, p_start_day: sd, p_end_month: em, p_end_day: ed }, "Season saved.", true)}
                onDelete={() => rpc("delete_booking_season", { p_id: s.id }, "Season deleted.", true)}
              />
              <SeasonHours key={sig(s.id)} seasonId={s.id} weekly={weekFor(s.id)} busy={busy} setBusy={setBusy} onSaved={loadConfig} supabase={supabase} />
            </AccordionCard>
          ))}

          {datedSeasons.length === 0 && (
            <p className="px-1 text-xs text-text-subtle">No seasons yet - the default times apply all year. Add a season for periods with different hours (e.g. longer summer evenings).</p>
          )}
        </div>
      </section>

      {/* Month grid */}
      <section className="order-1 border border-border bg-bg-elevated p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-accent">Calendar</h2>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))} className="shrink-0 border border-border-strong px-3 py-1 text-sm text-text-muted hover:border-accent hover:text-accent">←</button>
            <span className="w-28 text-center text-sm font-bold text-text sm:w-40">{monthLabel}</span>
            <button type="button" onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))} className="shrink-0 border border-border-strong px-3 py-1 text-sm text-text-muted hover:border-accent hover:text-accent">→</button>
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
            const cell = days[key];
            const open = cell?.is_open ?? true;
            const closed = !open;
            const isSel = selDate === key;
            const dayBookings = bookings[key] ?? [];
            const counts = countByStatus(dayBookings);
            return (
              <button
                key={key}
                type="button"
                onClick={() => { setSelDate(key); setMsg(null); }}
                className={`flex min-h-[4.2rem] flex-col items-start gap-0.5 border p-1.5 text-left transition-colors ${isSel ? "border-accent" : closed ? "border-red-500/30 hover:border-red-500/50" : "border-border hover:border-border-strong"} ${closed ? "bg-red-500/10" : "bg-bg"}`}
              >
                <span className={`text-xs font-bold ${closed ? "text-red-400" : "text-text"}`}>{dayNum}</span>
                {cell && (
                  <span className={`text-[0.65rem] font-bold uppercase tracking-[0.04em] ${closed ? "text-red-400" : "text-accent"}`}>
                    {closed
                      ? "Closed"
                      : cell.close_time
                        ? `${hhmm(cell.open_time)}–${hhmm(cell.close_time)}`
                        : hhmm(cell.open_time)}
                  </span>
                )}
                {cell?.is_override && <span className="text-[0.45rem] uppercase text-text-subtle">override</span>}
                {dayBookings.length > 0 && (
                  <span className="mt-auto flex flex-wrap gap-0.5 pt-0.5">
                    {STATUS_ORDER.map((st) =>
                      counts[st] ? (
                        <span key={st} className={`min-w-[0.9rem] rounded-sm px-1 text-center text-[0.55rem] font-bold ${STATUS_META[st].chip}`} title={`${counts[st]} ${STATUS_META[st].label}`}>
                          {counts[st]}
                        </span>
                      ) : null,
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[0.6rem] text-text-subtle">Closed days are shaded red. Coloured numbers are bookings by stage. Click a day for details or to change availability.</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {STATUS_ORDER.map((st) => (
            <span key={st} className="flex items-center gap-1.5 text-[0.6rem] text-text-muted">
              <span className={`h-3 w-3 rounded-sm ${STATUS_META[st].chip}`} />
              {STATUS_META[st].label}
            </span>
          ))}
        </div>
      </section>

      {selDate && (
        <DayEditor
          date={selDate}
          cell={sel}
          bookings={bookings[selDate] ?? []}
          organizers={organizers}
          busy={busy}
          onClose={() => setSelDate(null)}
          onSet={(is_open, open_time, close_time, note) => closeDay(open_time, close_time, note, is_open)}
          onReset={() => rpc("clear_booking_override", { p_date: selDate }, "Reset to the season / default hours.")}
          onReschedule={resolveReschedule}
          onCancel={resolveCancel}
        />
      )}

      {/* Blackout range */}
      <section className="order-4 border border-border bg-bg-elevated p-5">
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-accent">Blackout a range</h2>
        <p className="mt-1 mb-4 text-xs text-text-muted">Close every day in a range at once (e.g. while you&apos;re away). This overrides the season and default times.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-text-muted">From<br /><input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="mt-1 h-9 border border-border-strong bg-bg px-2 text-sm text-text" /></label>
          <label className="text-xs text-text-muted">To<br /><input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} className="mt-1 h-9 border border-border-strong bg-bg px-2 text-sm text-text" /></label>
          <label className="text-xs text-text-muted">Note (optional)<br /><input type="text" value={rangeNote} onChange={(e) => setRangeNote(e.target.value)} placeholder="Away / closed" className="mt-1 h-9 w-48 border border-border-strong bg-bg px-2 text-sm text-text" /></label>
          <Button type="button" size="sm" disabled={busy || !rangeFrom || !rangeTo} onClick={blockRange}>
            Block range
          </Button>
        </div>
      </section>

      {conflicts.length > 0 && (
        <section className="order-2 border border-amber-600/50 bg-amber-950/20 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-amber-300">Games affected by the blackout ({conflicts.length})</h2>
            <button type="button" onClick={() => setConflicts([])} className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-text-subtle hover:text-accent">Dismiss</button>
          </div>
          <p className="mb-4 text-xs text-text-muted">These games fall inside the closed dates. Contact the organiser to move each one, or cancel it (paid players are refunded automatically).</p>
          <ul className="space-y-2">
            {conflicts.map((b) => (
              <GameResolveRow key={b.id} booking={b} organizer={organizers[b.id]} busy={busy} onReschedule={resolveReschedule} onCancel={resolveCancel} />
            ))}
          </ul>
        </section>
      )}

      {msg && <p className="order-last text-sm text-accent">{msg}</p>}
    </div>
  );
}

/* ============================================================
   Accordion card
   ============================================================ */
function AccordionCard({ open, onToggle, title, subtitle, summary, children }: { open: boolean; onToggle: () => void; title: string; subtitle: string; summary: string; children: React.ReactNode }) {
  return (
    <div className="border border-border-strong bg-bg">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-text">{title}</span>
          <span className="block truncate text-[0.65rem] text-text-muted">{subtitle} · {summary}</span>
        </span>
        <svg aria-hidden viewBox="0 0 12 12" className={`h-3 w-3 shrink-0 text-accent transition-transform ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 2l4 4-4 4" strokeLinecap="square" />
        </svg>
      </button>
      {open && <div className="border-t border-border px-4 py-4">{children}</div>}
    </div>
  );
}

/* ============================================================
   Season dates editor (name + recurring start/end)
   ============================================================ */
function SeasonDates({ season, busy, onSave, onDelete }: { season: Season; busy: boolean; onSave: (name: string, sm: number, sd: number, em: number, ed: number) => void; onDelete: () => void }) {
  const [name, setName] = useState(season.name);
  const [sm, setSm] = useState(season.start_month ?? 1);
  const [sd, setSd] = useState(season.start_day ?? 1);
  const [em, setEm] = useState(season.end_month ?? 12);
  const [ed, setEd] = useState(season.end_day ?? 31);
  const dayInput = "h-9 w-16 border border-border-strong bg-bg px-2 text-sm text-text";
  const monthSel = "h-9 border border-border-strong bg-bg px-2 text-sm text-text";

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 border-b border-border pb-4">
      <label className="text-xs text-text-muted">Name<br /><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-9 w-40 border border-border-strong bg-bg px-2 text-sm text-text" /></label>
      <label className="text-xs text-text-muted">Starts<br />
        <span className="mt-1 flex items-center gap-2">
          <select value={sm} onChange={(e) => setSm(Number(e.target.value))} className={monthSel}>{MONTHS.map((mn, i) => <option key={mn} value={i + 1}>{mn}</option>)}</select>
          <input type="number" min={1} max={31} value={sd} onChange={(e) => setSd(Math.min(31, Math.max(1, Number(e.target.value) || 1)))} className={dayInput} />
        </span>
      </label>
      <label className="text-xs text-text-muted">Ends<br />
        <span className="mt-1 flex items-center gap-2">
          <select value={em} onChange={(e) => setEm(Number(e.target.value))} className={monthSel}>{MONTHS.map((mn, i) => <option key={mn} value={i + 1}>{mn}</option>)}</select>
          <input type="number" min={1} max={31} value={ed} onChange={(e) => setEd(Math.min(31, Math.max(1, Number(e.target.value) || 1)))} className={dayInput} />
        </span>
      </label>
      <Button type="button" size="sm" disabled={busy} onClick={() => onSave(name, sm, sd, em, ed)}>Save dates</Button>
      <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Delete the "${season.name}" season?`)) onDelete(); }} className="px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-text-subtle hover:text-red-400 disabled:opacity-50">
        Delete
      </button>
    </div>
  );
}

/* ============================================================
   Season hours editor (uniform by default; expand to per-day)
   ============================================================ */
function SeasonHours({
  seasonId,
  weekly,
  busy,
  setBusy,
  onSaved,
  supabase,
}: {
  seasonId: string;
  weekly: Weekly[];
  busy: boolean;
  setBusy: (b: boolean) => void;
  onSaved: () => Promise<void>;
  supabase: ReturnType<typeof createClient>;
}) {
  const u = computeUniform(weekly);
  const [mode, setMode] = useState<"uniform" | "custom">(u.uniform ? "uniform" : "custom");
  const [uIsOpen, setUIsOpen] = useState(u.isOpen);
  const [uOpen, setUOpen] = useState(u.open);
  const [uClose, setUClose] = useState(u.close);
  const [days, setDays] = useState<Weekly[]>(weekly);
  const [localMsg, setLocalMsg] = useState<string | null>(null);

  function setDay(weekday: number, patch: Partial<Weekly>) {
    setDays((prev) => prev.map((w) => (w.weekday === weekday ? { ...w, ...patch } : w)));
    setLocalMsg(null);
  }

  async function save() {
    setBusy(true);
    setLocalMsg(null);
    if (mode === "uniform") {
      const { error } = await supabase.rpc("set_booking_weekly_all", { p_season_id: seasonId, p_is_open: uIsOpen, p_open: uOpen, p_close: uClose });
      if (error) { setBusy(false); return setLocalMsg(error.message); }
    } else {
      for (const w of days) {
        const { error } = await supabase.rpc("set_booking_weekly", { p_season_id: seasonId, p_weekday: w.weekday, p_is_open: w.is_open, p_open: w.open_time, p_close: w.close_time });
        if (error) { setBusy(false); return setLocalMsg(error.message); }
      }
    }
    setBusy(false);
    setLocalMsg("Hours saved.");
    await onSaved();
  }

  const timeInput = "h-9 border border-border-strong bg-bg px-2 text-sm text-text";

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {(["uniform", "custom"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`border px-3 py-1.5 text-[0.6rem] font-bold uppercase tracking-[0.1em] ${mode === m ? "border-accent bg-accent/10 text-accent" : "border-border-strong text-text-muted hover:border-accent hover:text-accent"}`}
          >
            {m === "uniform" ? "Same hours every day" : "Customize days"}
          </button>
        ))}
      </div>

      {mode === "uniform" ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setUIsOpen((v) => !v)}
            className={`border px-3 py-1 text-[0.6rem] font-bold uppercase tracking-[0.1em] ${uIsOpen ? "border-accent bg-accent/10 text-accent" : "border-border-strong text-text-subtle"}`}
          >
            {uIsOpen ? "Open" : "Closed"}
          </button>
          {uIsOpen && (
            <span className="flex items-center gap-2 text-sm text-text-muted">
              <input type="time" value={uOpen} onChange={(e) => setUOpen(e.target.value)} className={timeInput} />
              <span>to</span>
              <input type="time" value={uClose} onChange={(e) => setUClose(e.target.value)} className={timeInput} />
              <span className="text-[0.65rem] text-text-subtle">(finish by)</span>
            </span>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {WEEK_ORDER.map((wd) => {
            const w = days.find((x) => x.weekday === wd)!;
            return (
              <div key={wd} className="flex flex-wrap items-center gap-3 border-b border-border py-2 last:border-0">
                <span className="w-24 text-sm font-semibold text-text">{WEEKDAY_FULL[wd]}</span>
                <button
                  type="button"
                  onClick={() => setDay(wd, { is_open: !w.is_open })}
                  className={`border px-3 py-1 text-[0.6rem] font-bold uppercase tracking-[0.1em] ${w.is_open ? "border-accent bg-accent/10 text-accent" : "border-border-strong text-text-subtle"}`}
                >
                  {w.is_open ? "Open" : "Closed"}
                </button>
                {w.is_open && (
                  <span className="flex items-center gap-2 text-sm text-text-muted">
                    <input type="time" value={hhmm(w.open_time)} onChange={(e) => setDay(wd, { open_time: e.target.value })} className={timeInput} />
                    <span>to</span>
                    <input type="time" value={hhmm(w.close_time)} onChange={(e) => setDay(wd, { close_time: e.target.value })} className={timeInput} />
                    <span className="text-[0.65rem] text-text-subtle">(finish by)</span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-[0.65rem] text-text-subtle">Games must finish by the end time (a ~3h session), so the latest start is 3h before it.</p>
      <div className="mt-3 flex items-center gap-3">
        <Button type="button" size="sm" onClick={save} disabled={busy}>Save hours</Button>
        {localMsg && <span className="text-xs text-accent">{localMsg}</span>}
      </div>
    </div>
  );
}

/* ============================================================
   Games-affected row (move / cancel)
   ============================================================ */
function GameResolveRow({ booking, organizer, busy, onReschedule, onCancel }: { booking: Booking; organizer: Organizer | undefined; busy: boolean; onReschedule: (id: string, iso: string) => void; onCancel: (id: string) => void }) {
  const [moving, setMoving] = useState(false);
  const [when, setWhen] = useState("");
  const time = booking.scheduled_at ? new Date(booking.scheduled_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  const meta = booking.status ? STATUS_META[booking.status] : null;
  const phone = organizer?.phone_e164;
  const name = organizer?.full_name || organizer?.ops_tag;
  return (
    <li className="border border-border bg-bg px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/admin/matches/${booking.id}`} className="text-sm font-bold text-text hover:text-accent">
            {booking.title || "Match"}{booking.is_private ? " · private" : ""}
          </Link>
          <p className="text-[0.65rem] text-text-muted">
            {time}
            {` · organiser: ${name || "LaserOps"}`}
            {phone ? <> · <a href={`tel:${phone}`} className="text-accent hover:underline">{phone}</a></> : name ? " · no phone on file" : ""}
          </p>
        </div>
        <span className="flex items-center gap-2">
          {meta && <span className={`rounded-sm px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-[0.06em] ${meta.chip}`}>{meta.label}</span>}
          <button type="button" disabled={busy} onClick={() => setMoving((v) => !v)} className="border border-border-strong px-3 py-1 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-text-muted hover:border-accent hover:text-accent disabled:opacity-50">Move</button>
          <button type="button" disabled={busy} onClick={() => onCancel(booking.id)} className="border border-red-500/50 px-3 py-1 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-red-400 hover:bg-red-500/10 disabled:opacity-50">Cancel</button>
        </span>
      </div>
      {moving && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-9 border border-border-strong bg-bg px-2 text-sm text-text" />
          <button type="button" disabled={busy || !when} onClick={() => when && onReschedule(booking.id, new Date(when).toISOString())} className="border border-accent bg-accent px-3 py-1.5 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-bg disabled:opacity-50">
            Confirm move
          </button>
        </div>
      )}
    </li>
  );
}

/* ============================================================
   Day editor (single-date override)
   ============================================================ */
function DayEditor({ date, cell, bookings, organizers, busy, onClose, onSet, onReset, onReschedule, onCancel }: { date: string; cell: DayCell | null; bookings: Booking[]; organizers: Record<string, Organizer>; busy: boolean; onClose: () => void; onSet: (isOpen: boolean, open: string | null, close: string | null, note: string | null) => void; onReset: () => void; onReschedule: (id: string, iso: string) => void; onCancel: (id: string) => void }) {
  const [mode, setMode] = useState<"open" | "custom" | "closed">(cell && !cell.is_open ? "closed" : cell?.is_override && cell.open_time ? "custom" : "open");
  const [open, setOpen] = useState(hhmm(cell?.open_time ?? null) || "09:00");
  const [close, setClose] = useState(hhmm(cell?.close_time ?? null) || "22:00");
  const [note, setNote] = useState(cell?.note ?? "");
  const label = new Date(date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto border border-border-strong bg-bg-elevated p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-muted">Day details</p>
        <p className="mb-3 mt-1 text-sm font-bold text-text">{label}</p>

        {bookings.length > 0 && (
          <div className="mb-4 border-b border-border pb-4">
            <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-text-muted">Bookings ({bookings.length})</p>
            <ul className="space-y-2">
              {bookings.map((b) => (
                <GameResolveRow key={b.id} booking={b} organizer={organizers[b.id]} busy={busy} onReschedule={onReschedule} onCancel={onCancel} />
              ))}
            </ul>
          </div>
        )}

        <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-text-muted">Availability</p>
        <div className="flex flex-col gap-2">
          {(["open", "custom", "closed"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={`border px-3 py-2 text-left text-xs font-bold uppercase tracking-[0.1em] ${mode === m ? "border-accent bg-accent/10 text-accent" : "border-border-strong text-text-muted"}`}>
              {m === "open" ? "Open (season / default hours)" : m === "custom" ? "Open (custom hours)" : "Closed"}
            </button>
          ))}
        </div>

        {mode === "custom" && (
          <div className="mt-3 flex items-center gap-2 text-sm text-text-muted">
            <input type="time" value={open} onChange={(e) => setOpen(e.target.value)} className="h-9 border border-border-strong bg-bg px-2 text-sm text-text" />
            <span>to</span>
            <input type="time" value={close} onChange={(e) => setClose(e.target.value)} className="h-9 border border-border-strong bg-bg px-2 text-sm text-text" />
            <span className="text-[0.65rem] text-text-subtle">(finish by)</span>
          </div>
        )}

        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="mt-3 h-9 w-full border border-border-strong bg-bg px-2 text-sm text-text" />

        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={busy} onClick={() => { if (mode === "closed") onSet(false, null, null, note); else if (mode === "custom") onSet(true, open, close, note); else onSet(true, null, null, note); onClose(); }}>
            Save
          </Button>
          {cell?.is_override && (
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => { onReset(); onClose(); }}>Reset to season / default</Button>
          )}
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-text-subtle hover:text-accent">Cancel</button>
        </div>
      </div>
    </div>
  );
}
