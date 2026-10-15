/**
 * app/admin/landing-stats/page.tsx
 * --------------------------------------------------------------------
 * First-party visit counter for landing pages (Welbee's QR offer). Counts every
 * visitor, including the ones who decline cookies and so never reach GA4.
 * Data: page_events via the page_event_daily / page_event_sources RPCs, written
 * by /api/track. Unique visitors are counted per day (the hash rotates daily),
 * so range totals add up daily uniques rather than de-duplicating across days.
 */
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Landing page stats" };
export const dynamic = "force-dynamic";

const PATH = "/welbees-offer";

type Day = { day: string; views: number; visitors: number; cta_signup: number; cta_games: number };
type Source = { source: string; views: number; visitors: number };

function maltaDay(offset = 0): string {
  const d = new Date(Date.now() - offset * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Malta" }).format(d);
}

function sum(rows: Day[], from?: string) {
  const r = from ? rows.filter((d) => d.day >= from) : rows;
  return r.reduce(
    (a, d) => ({ views: a.views + d.views, visitors: a.visitors + d.visitors, signup: a.signup + d.cta_signup, games: a.games + d.cta_games }),
    { views: 0, visitors: 0, signup: 0, games: 0 },
  );
}

function fmtDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default async function LandingStatsPage() {
  const supabase = await createClient();
  const [{ data: daily }, { data: sources }] = await Promise.all([
    supabase.rpc("page_event_daily", { p_path: PATH }),
    supabase.rpc("page_event_sources", { p_path: PATH }),
  ]);

  const days: Day[] = ((daily ?? []) as Day[]).map((d) => ({
    day: String(d.day),
    views: Number(d.views) || 0,
    visitors: Number(d.visitors) || 0,
    cta_signup: Number(d.cta_signup) || 0,
    cta_games: Number(d.cta_games) || 0,
  }));
  const srcs: Source[] = ((sources ?? []) as Source[]).map((s) => ({
    source: String(s.source),
    views: Number(s.views) || 0,
    visitors: Number(s.visitors) || 0,
  }));

  const ranges = [
    { label: "Today", t: sum(days, maltaDay()) },
    { label: "Last 7 days", t: sum(days, maltaDay(6)) },
    { label: "Last 30 days", t: sum(days, maltaDay(29)) },
    { label: "All time", t: sum(days) },
  ];

  return (
    <div>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Landing page stats</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          Visits to the Welbee&rsquo;s offer page (<span className="font-mono">{PATH}</span>), counted on our own server with no cookies, so
          every visitor shows up here even if they decline the cookie banner. Visitors are unique per day.
        </p>
      </header>

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ranges.map(({ label, t }) => (
          <div key={label} className="border border-border bg-bg-elevated px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</p>
            <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-accent">{t.visitors}</p>
            <p className="text-[0.7rem] text-text-subtle">visitors · {t.views} views</p>
            <p className="mt-2 text-[0.7rem] text-text-muted">
              Create account: <b className="tabular-nums text-text">{t.signup}</b> · Browse games: <b className="tabular-nums text-text">{t.games}</b>
            </p>
          </div>
        ))}
      </section>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <section className="border border-border bg-bg-elevated px-5 py-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.12em] text-accent">By day</h2>
          {days.length === 0 ? (
            <p className="text-sm text-text-muted">No visits recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[0.65rem] uppercase tracking-[0.12em] text-text-muted">
                    <th className="py-2 pr-4 font-semibold">Day</th>
                    <th className="py-2 pr-4 text-right font-semibold">Visitors</th>
                    <th className="py-2 pr-4 text-right font-semibold">Views</th>
                    <th className="py-2 pr-4 text-right font-semibold">Create account</th>
                    <th className="py-2 text-right font-semibold">Browse games</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => (
                    <tr key={d.day} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-4 text-text">{fmtDay(d.day)}</td>
                      <td className="py-2 pr-4 text-right font-mono tabular-nums text-accent">{d.visitors}</td>
                      <td className="py-2 pr-4 text-right font-mono tabular-nums">{d.views}</td>
                      <td className="py-2 pr-4 text-right font-mono tabular-nums">{d.cta_signup}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{d.cta_games}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="border border-border bg-bg-elevated px-5 py-5">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-[0.12em] text-accent">Where they came from</h2>
          <p className="mb-4 text-[0.7rem] text-text-subtle">From the link&rsquo;s utm_source, otherwise the referring site.</p>
          {srcs.length === 0 ? (
            <p className="text-sm text-text-muted">No visits recorded yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {srcs.map((s) => (
                <li key={s.source} className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-text">{s.source}</span>
                  <span className="shrink-0 font-mono tabular-nums text-text-muted">
                    <b className="text-accent">{s.visitors}</b> / {s.views}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
