/**
 * app/admin/seasons/page.tsx
 * --------------------------------------------------------------------
 * Admin season list. Drives the leaderboards' Challenges tab + Hall of Fame.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Seasons" };

type Row = {
  id: string;
  name: string | null;
  season_number: number | null;
  status: string | null;
  starts_on: string | null;
  ends_on: string | null;
};

const statusStyle: Record<string, string> = {
  active: "text-accent",
  upcoming: "text-text-muted",
  completed: "text-text-subtle",
};

export default async function AdminSeasonsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seasons")
    .select("id, name, season_number, status, starts_on, ends_on")
    .order("season_number");
  const rows = (data ?? []) as Row[];

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
            Seasons
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            {rows.length} seasons. Windows + status drive the Challenges tab and Hall of Fame.
          </p>
        </div>
        <Link
          href="/admin/seasons/new"
          className="flex h-11 items-center gap-2 border border-accent bg-accent px-5 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98]"
        >
          + New season
        </Link>
      </header>

      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-elevated text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
              <th className="px-4 py-3 font-semibold">#</th>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Window</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0 hover:bg-bg-elevated/50">
                <td className="px-4 py-3 font-mono text-text-muted">{s.season_number}</td>
                <td className="px-4 py-3 font-semibold text-text">{s.name}</td>
                <td className={`px-4 py-3 uppercase ${statusStyle[s.status ?? ""] ?? "text-text-muted"}`}>
                  {s.status}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-text-subtle">
                  {s.starts_on ?? "–"} → {s.ends_on ?? "–"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/seasons/${s.id}`} className="text-xs font-bold uppercase tracking-[0.12em] text-accent hover:text-accent-soft">
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
