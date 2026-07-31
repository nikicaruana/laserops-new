/**
 * app/admin/page.tsx
 * --------------------------------------------------------------------
 * Admin dashboard. Overview cards for each config area with a live row
 * count. Built areas link through; the rest are placeholders until wired.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

async function countOf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
): Promise<number | null> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  return error ? null : (count ?? 0);
}

export default async function AdminDashboard() {
  const supabase = await createClient();
  const [guns, accolades, seasons, challenges] = await Promise.all([
    countOf(supabase, "guns"),
    countOf(supabase, "accolade_definitions"),
    countOf(supabase, "seasons"),
    countOf(supabase, "challenges"),
  ]);

  const cards: {
    label: string;
    href?: string;
    count: number | null;
    hint: string;
  }[] = [
    { label: "Guns", href: "/admin/guns", count: guns, hint: "Catalogue, specs, damage timeline" },
    { label: "Accolades", href: "/admin/accolades", count: accolades, hint: "Definitions, XP tiers, badges" },
    { label: "Scoring formula", href: "/admin/scoring", count: null, hint: "Weights + live preview" },
    { label: "Seasons", href: "/admin/seasons", count: seasons, hint: "Windows + status" },
    { label: "Challenges", href: "/admin/challenges", count: challenges, hint: "Per-season leaderboards" },
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => {
          const inner = (
            <>
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-text">
                  {c.label}
                </h2>
                {c.count !== null && (
                  <span className="font-mono text-lg font-bold tabular-nums text-accent">
                    {c.count}
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-text-muted">{c.hint}</p>
              {!c.href && (
                <span className="mt-3 inline-block text-[0.55rem] font-bold uppercase tracking-[0.16em] text-text-subtle/60">
                  Coming soon
                </span>
              )}
            </>
          );
          return c.href ? (
            <Link
              key={c.label}
              href={c.href}
              className="group border border-border bg-bg-elevated px-5 py-5 transition-colors hover:border-accent"
            >
              {inner}
            </Link>
          ) : (
            <div
              key={c.label}
              className="border border-dashed border-border bg-bg-elevated/50 px-5 py-5 opacity-70"
            >
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
