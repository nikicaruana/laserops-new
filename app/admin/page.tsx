/**
 * app/admin/page.tsx
 * --------------------------------------------------------------------
 * Admin dashboard. Overview cards for each config area with a live row
 * count. Built areas link through; the rest are placeholders until wired.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RecomputeButton } from "@/components/admin/RecomputeButton";
import { AdminNotificationSummary } from "@/components/admin/AdminNotificationSummary";
import { FinancialSummary } from "@/components/admin/FinancialSummary";

function whenText(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function countByStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  status: string,
): Promise<number> {
  const { count } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true })
    .eq("status", status);
  return count ?? 0;
}

export default async function AdminDashboard() {
  const supabase = await createClient();
  const [{ data: status }, tentative, awaiting, confirmed, { data: live }] = await Promise.all([
    supabase.from("read_model_status").select("last_recomputed_at").maybeSingle(),
    countByStatus(supabase, "tentative"),
    countByStatus(supabase, "awaiting_confirm"),
    countByStatus(supabase, "confirmed"),
    supabase
      .from("matches")
      .select("id, title, match_code, scheduled_at")
      .eq("status", "live")
      .order("went_live_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const matchStats: { label: string; count: number; status: string }[] = [
    { label: "Tentative", count: tentative, status: "tentative" },
    { label: "Awaiting OK", count: awaiting, status: "awaiting_confirm" },
    { label: "Confirmed", count: confirmed, status: "confirmed" },
  ];

  return (
    <div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          Admin
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Manage the game config. Changes save straight to the database and take
          effect where they&rsquo;re read.
        </p>
      </header>

      {/* Recent notifications (scrollable summary) */}
      <AdminNotificationSummary />

      {/* Match Manager summary */}
      <section className="mb-8 border border-border bg-bg-elevated px-5 py-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-accent">Match Manager</h2>
          <Link href="/admin/matches" className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
            Open →
          </Link>
        </div>

        {live && (
          <Link
            href={`/admin/matches/${live.id}`}
            className="mb-5 flex flex-wrap items-center justify-between gap-3 border border-accent bg-accent/10 px-5 py-4 transition-colors hover:bg-accent/20"
          >
            <span className="flex items-center gap-3">
              <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-accent" aria-hidden />
              <span className="text-sm font-bold uppercase tracking-[0.1em] text-accent">
                Live now: {live.title || live.match_code || "Match in play"}
              </span>
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-accent">Go to live match →</span>
          </Link>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {matchStats.map((s) => (
            <Link
              key={s.status}
              href={`/admin/matches?status=${s.status}`}
              className="group border border-border bg-bg px-5 py-4 transition-colors hover:border-accent"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted group-hover:text-accent">
                  {s.label}
                </span>
                <span className="font-mono text-2xl font-bold tabular-nums text-accent">{s.count}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Financial summary (period-comparable) */}
      <FinancialSummary />

      {/* Maintenance */}
      <section className="mt-8 border border-border bg-bg-elevated px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-accent">
              Recompute read-models
            </h2>
            <p className="mt-2 max-w-xl text-xs text-text-muted">
              Rebuilds the derived tables (lifetime stats, period stats, gun stats, ratings, season
              standings) from stored match data + current config. Run after importing games or
              editing season / challenge / rating config. Does not re-score past games.
            </p>
            <p className="mt-2 text-[0.65rem] text-text-subtle">
              Last run: {whenText(status?.last_recomputed_at ?? null)}
            </p>
          </div>
          <RecomputeButton />
        </div>
      </section>
    </div>
  );
}
