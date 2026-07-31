/**
 * app/admin/accolades/page.tsx
 * --------------------------------------------------------------------
 * Admin accolade list. Badge + name + tier + scope; click through to edit.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Accolades" };

type Row = {
  id: string;
  name: string | null;
  description: string | null;
  badge_url: string | null;
  xp: number | null;
  scope: string | null;
  is_active: boolean | null;
};

function tier(xp: number | null): string {
  if (xp === 100) return "T1";
  if (xp === 75) return "T2";
  if (xp === 50) return "T3";
  return "—";
}

export default async function AdminAccoladesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accolade_definitions")
    .select("id, name, description, badge_url, xp, scope, is_active")
    .order("xp", { ascending: false })
    .order("name");
  const rows = (data ?? []) as Row[];

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
            Accolades
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            {rows.length} accolades. Name, badge, XP tier, and scope.
          </p>
        </div>
        <Link
          href="/admin/accolades/new"
          className="flex h-11 items-center gap-2 border border-accent bg-accent px-5 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98]"
        >
          + New accolade
        </Link>
      </header>

      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-elevated text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
              <th className="px-4 py-3 font-semibold">Accolade</th>
              <th className="px-4 py-3 font-semibold">Awarded for</th>
              <th className="px-4 py-3 text-center font-semibold">Tier</th>
              <th className="px-4 py-3 text-right font-semibold">XP</th>
              <th className="px-4 py-3 text-center font-semibold">Scope</th>
              <th className="px-4 py-3 text-center font-semibold">Active</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b border-border last:border-0 hover:bg-bg-elevated/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {a.badge_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.badge_url} alt="" className="h-9 w-9 shrink-0 object-contain" />
                    ) : (
                      <div className="h-9 w-9 shrink-0 border border-dashed border-border" />
                    )}
                    <span className="font-semibold text-text">{a.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-text-muted">{a.description}</td>
                <td className="px-4 py-3 text-center font-mono text-text-muted">{tier(a.xp)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-text">{a.xp ?? "—"}</td>
                <td className="px-4 py-3 text-center text-text-muted">{a.scope}</td>
                <td className="px-4 py-3 text-center">
                  {a.is_active ? <span className="text-accent">●</span> : <span className="text-text-subtle/50">○</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/accolades/${a.id}`} className="text-xs font-bold uppercase tracking-[0.12em] text-accent hover:text-accent-soft">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
