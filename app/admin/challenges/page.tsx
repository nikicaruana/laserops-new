/**
 * app/admin/challenges/page.tsx
 * --------------------------------------------------------------------
 * Admin challenge list, scoped to a season (tabs). Drives the leaderboards'
 * Challenges tab + Hall of Fame champions.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Challenges" };

type Season = { season_number: number; name: string | null; status: string | null };
type Challenge = {
  id: string;
  challenge_number: number | null;
  challenge_name: string | null;
  source_mode: string | null;
  metric: string | null;
  prize: string | null;
};

export default async function AdminChallengesPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const { season } = await searchParams;
  const supabase = await createClient();

  const { data: seasonRows } = await supabase
    .from("seasons")
    .select("season_number, name, status")
    .order("season_number");
  const seasons = (seasonRows ?? []) as Season[];

  const paramNum = season ? Number(season) : NaN;
  const selected =
    seasons.find((s) => s.season_number === paramNum) ??
    seasons.find((s) => s.status === "active") ??
    seasons[seasons.length - 1] ??
    null;
  const seasonNumber = selected?.season_number ?? null;

  const { data: chalRows } = seasonNumber
    ? await supabase
        .from("challenges")
        .select("id, challenge_number, challenge_name, source_mode, metric, prize")
        .eq("season_number", seasonNumber)
        .order("priority")
        .order("challenge_number")
    : { data: [] };
  const challenges = (chalRows ?? []) as Challenge[];

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
            Challenges
          </h1>
          <p className="mt-2 text-sm text-text-muted">Per-season leaderboards + prizes.</p>
        </div>
        {seasonNumber != null && (
          <Link
            href={`/admin/challenges/new?season=${seasonNumber}`}
            className="flex h-11 items-center gap-2 border border-accent bg-accent px-5 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98]"
          >
            + New challenge
          </Link>
        )}
      </header>

      {/* Season tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {seasons.map((s) => (
          <Link
            key={s.season_number}
            href={`/admin/challenges?season=${s.season_number}`}
            className={`border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] ${
              s.season_number === seasonNumber
                ? "border-accent bg-bg-elevated text-accent"
                : "border-border-strong text-text-muted hover:border-accent hover:text-accent"
            }`}
          >
            {s.name ?? `Season ${s.season_number}`}
          </Link>
        ))}
      </div>

      {seasons.length === 0 ? (
        <p className="text-sm text-text-muted">
          No seasons yet. <Link href="/admin/seasons/new" className="text-accent">Create a season</Link> first.
        </p>
      ) : challenges.length === 0 ? (
        <p className="text-sm text-text-muted">No challenges in this season yet.</p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-elevated text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Metric</th>
                <th className="px-4 py-3 font-semibold">Prize</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {challenges.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-bg-elevated/50">
                  <td className="px-4 py-3 font-mono text-text-muted">{c.challenge_number}</td>
                  <td className="px-4 py-3 font-semibold text-text">{c.challenge_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">{c.metric}</td>
                  <td className="px-4 py-3 text-text-muted">{c.prize}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/challenges/${c.id}`} className="text-xs font-bold uppercase tracking-[0.12em] text-accent hover:text-accent-soft">
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
