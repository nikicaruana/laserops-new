/**
 * app/admin/killstreaks/page.tsx
 * --------------------------------------------------------------------
 * Admin killstreak list. Icon + name + scope/duration + unlock streak + active;
 * click through to edit. Killstreaks are streak-unlocked abilities a player
 * deploys from the live feed to jam the enemy team's feed.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BadgePreview } from "@/components/admin/BadgePreview";

export const metadata = { title: "Killstreaks" };

type Row = {
  id: string;
  key: string | null;
  name: string | null;
  icon: string | null;
  badge_url: string | null;
  scope: string | null;
  duration_seconds: number | null;
  unlock_streak_key: string | null;
  is_active: boolean | null;
};

export default async function AdminKillstreaksPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("killstreak_definitions")
    .select("id, key, name, icon, badge_url, scope, duration_seconds, unlock_streak_key, is_active")
    .order("sort_order")
    .order("name");
  const rows = (data ?? []) as Row[];

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
            Killstreaks
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            {rows.length} killstreaks. Streak-unlocked abilities players deploy from the live feed to jam the enemy team&apos;s feed.
          </p>
        </div>
        <Link
          href="/admin/killstreaks/new"
          className="flex h-11 items-center gap-2 border border-accent bg-accent px-5 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98]"
        >
          + New killstreak
        </Link>
      </header>

      {rows.length === 0 ? (
        <p className="border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">
          No killstreaks yet. Create one to let streaks unlock a deployable ability.
        </p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-elevated text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
                <th className="px-4 py-3 font-semibold">Killstreak</th>
                <th className="px-4 py-3 font-semibold">Scope</th>
                <th className="px-4 py-3 text-right font-semibold">Duration</th>
                <th className="px-4 py-3 font-semibold">Unlocked by</th>
                <th className="px-4 py-3 text-center font-semibold">Active</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((k) => (
                <tr key={k.id} className="border-b border-border last:border-0 hover:bg-bg-elevated/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {k.badge_url ? (
                        <BadgePreview src={k.badge_url} alt={k.name ?? "Killstreak"} className="h-9 w-9" />
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-border text-lg">
                          {k.icon || "•"}
                        </span>
                      )}
                      <span className="font-semibold text-text">{k.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{k.scope === "all" ? "All bases" : "One base"}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-text">{k.duration_seconds ?? 0}s</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">{k.unlock_streak_key ?? "–"}</td>
                  <td className="px-4 py-3 text-center">
                    {k.is_active ? <span className="text-accent">●</span> : <span className="text-text-subtle/50">○</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/killstreaks/${k.id}`} className="text-xs font-bold uppercase tracking-[0.12em] text-accent hover:text-accent-soft">
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
