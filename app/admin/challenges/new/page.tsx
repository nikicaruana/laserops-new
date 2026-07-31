/**
 * app/admin/challenges/new/page.tsx
 * --------------------------------------------------------------------
 * Create a new challenge. Season + challenge number pre-filled from the
 * ?season= context and the next free challenge number.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChallengeEditor, type ChallengeRecord } from "@/components/admin/ChallengeEditor";

export const metadata = { title: "New challenge" };

export default async function NewChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const { season } = await searchParams;
  const seasonNumber = season ? Number(season) : null;

  const supabase = await createClient();
  let nextChallenge = 1;
  if (seasonNumber != null) {
    const { data: last } = await supabase
      .from("challenges")
      .select("challenge_number")
      .eq("season_number", seasonNumber)
      .order("challenge_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    nextChallenge = (last?.challenge_number ?? 0) + 1;
  }

  const blank: ChallengeRecord = {
    id: "",
    season_number: seasonNumber,
    challenge_number: nextChallenge,
    challenge_name: "",
    description: "",
    prize: "",
    priority: nextChallenge,
    source_mode: "period_summed",
    metric: "",
    tiebreak_1: "",
    tiebreak_2: "",
    top_n: 50,
    prize_cutoff: 2,
    threshold: null,
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 text-xs">
        <Link
          href={`/admin/challenges?season=${seasonNumber ?? ""}`}
          className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent"
        >
          ← Challenges
        </Link>
      </div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          New challenge
        </h1>
        {seasonNumber != null && (
          <p className="mt-1 text-sm text-text-muted">Season {seasonNumber}</p>
        )}
      </header>

      <ChallengeEditor challenge={blank} mode="create" />
    </div>
  );
}
