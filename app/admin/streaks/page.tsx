/**
 * app/admin/streaks/page.tsx
 * --------------------------------------------------------------------
 * Admin streak list. Badge + name + points/XP + active; click through to edit.
 * Streaks are event-level rewards that can fire multiple times per round.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Streaks" };

type Row = {
  id: string;
  name: string | null;
  description: string | null;
  badge_url: string | null;
  xp: number | null;
  points: number | null;
  tier: number | null;
  is_active: boolean | null;
};

export default async function AdminStreaksPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("streak_definitions")
    .select("id, name, description, badge_url, xp, points, tier, is_active")
    .order("tier")
    .order("name");
  const rows = (data ?? []) as Row[];

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
            Streaks
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            {rows.length} streaks. Event-level rewards that can fire more than once per round.
          </p>
        </div>
        <Link
          href="/admin/streaks/new"
          className="flex h-11 items-center gap-2 border border-accent bg-accent px-5 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98]"
        >
          + New streak
        </Link>
      </header>

      {rows.length === 0 ? (
        <p className="border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">
          No streaks yet. Create one to start rewarding kill / capture streaks.
        </p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-elevated text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
                <th className="px-4 py-3 font-semibold">Streak</th>
                <th className="px-4 py-3 font-semibold">Earned for</th>
                <th className="px-4 py-3 text-center font-semibold">Tier</th>
                <th className="px-4 py-3 text-right font-semibold">Points</th>
                <th className="px-4 py-3 text-center font-semibold">Active</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-bg-elevated/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {s.badge_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.badge_url} alt="" className="h-9 w-9 shrink-0 object-contain" />
                      ) : (
                        <div className="h-9 w-9 shrink-0 border border-dashed border-border" />
                      )}
                      <span className="font-semibold text-text">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{s.description}</td>
                  <td className="px-4 py-3 text-center font-mono tabular-nums text-text-muted">{s.tier ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-text">{s.points ?? 0}</td>
                  <td className="px-4 py-3 text-center">
                    {s.is_active ? <span className="text-accent">●</span> : <span className="text-text-subtle/50">○</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/streaks/${s.id}`} className="text-xs font-bold uppercase tracking-[0.12em] text-accent hover:text-accent-soft">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
