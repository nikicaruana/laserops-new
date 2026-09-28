/**
 * app/admin/squads/page.tsx
 * --------------------------------------------------------------------
 * Admin: all squads (admin_all RLS lets admins read every squad, incl. private).
 * Search by name; click through to manage.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Squads" };

type Row = { id: string; name: string; member_count: number | null; is_searchable: boolean | null; created_at: string | null };

export default async function AdminSquadsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("squads").select("id, name, member_count, is_searchable, created_at").order("member_count", { ascending: false }).limit(200);
  if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "")}%`);
  const { data } = await query;
  const rows = (data ?? []) as Row[];

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Squads</h1>
          <p className="mt-2 text-sm text-text-muted">Every squad. Click one to manage it.</p>
        </div>
        <form action="/admin/squads" method="get">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search squads…"
            className="h-9 w-56 max-w-full rounded-none border border-border-strong bg-bg-elevated px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
          />
        </form>
      </header>

      {rows.length === 0 ? (
        <p className="border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">No squads{q ? " match that search" : " yet"}.</p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-elevated text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
                <th className="px-4 py-3 font-semibold">Squad</th>
                <th className="px-4 py-3 text-right font-semibold">Members</th>
                <th className="px-4 py-3 font-semibold">Visibility</th>
                <th className="px-4 py-3 text-right font-semibold" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-bg-elevated/50">
                  <td className="px-4 py-3 font-semibold text-text">{s.name}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-text-muted">{s.member_count ?? 0}/20</td>
                  <td className="px-4 py-3 text-text-muted">{s.is_searchable ? "Public" : "Invite-only"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link href={`/admin/squads/${s.id}`} className="text-xs font-bold uppercase tracking-[0.12em] text-accent hover:text-accent-soft">
                      Manage
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
