/**
 * app/admin/guns/page.tsx
 * --------------------------------------------------------------------
 * Admin gun list. Every gun with a thumbnail + key specs; click through to
 * edit. Read here; writes happen on the edit page (RLS admin-write).
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Guns" };

type GunRow = {
  id: string;
  name: string | null;
  image_url: string | null;
  class: string | null;
  tree_branch: string | null;
  damage: number | null;
  is_visible: boolean | null;
  sort_order: number | null;
};

export default async function AdminGunsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("guns")
    .select("id, name, image_url, class, tree_branch, damage, is_visible, sort_order")
    .order("sort_order");
  const guns = (data ?? []) as GunRow[];

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
            Guns
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            {guns.length} weapons. Edit specs, unlock rules, and the damage
            timeline.
          </p>
        </div>
      </header>

      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-elevated text-[0.6rem] uppercase tracking-[0.14em] text-text-subtle">
              <th className="px-4 py-3 font-semibold">Gun</th>
              <th className="px-4 py-3 font-semibold">Class</th>
              <th className="px-4 py-3 font-semibold">Tree</th>
              <th className="px-4 py-3 text-right font-semibold">Damage</th>
              <th className="px-4 py-3 text-center font-semibold">Visible</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {guns.map((g) => (
              <tr
                key={g.id}
                className="border-b border-border last:border-0 hover:bg-bg-elevated/50"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {g.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={g.image_url}
                        alt=""
                        className="h-8 w-14 shrink-0 object-contain"
                      />
                    ) : (
                      <div className="h-8 w-14 shrink-0 border border-dashed border-border" />
                    )}
                    <span className="font-semibold text-text">{g.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-text-muted">{g.class}</td>
                <td className="px-4 py-3 text-text-muted">{g.tree_branch}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-text">
                  {g.damage ?? "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  {g.is_visible ? (
                    <span className="text-accent">●</span>
                  ) : (
                    <span className="text-text-subtle/50">○</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/guns/${g.id}`}
                    className="text-xs font-bold uppercase tracking-[0.12em] text-accent hover:text-accent-soft"
                  >
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
