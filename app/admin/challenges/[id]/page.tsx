/**
 * app/admin/challenges/[id]/page.tsx
 * --------------------------------------------------------------------
 * Edit one challenge + delete.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChallengeEditor, type ChallengeRecord } from "@/components/admin/ChallengeEditor";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("challenges").select("challenge_name").eq("id", id).maybeSingle();
  return { title: data?.challenge_name ? `${data.challenge_name} · Challenges` : "Edit challenge" };
}

export default async function EditChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: challenge } = await supabase
    .from("challenges")
    .select(
      "id, season_number, challenge_number, challenge_name, description, prize, priority, source_mode, metric, tiebreak_1, tiebreak_2, top_n, prize_cutoff, threshold",
    )
    .eq("id", id)
    .maybeSingle();
  if (!challenge) notFound();

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 text-xs">
        <Link
          href={`/admin/challenges?season=${challenge.season_number ?? ""}`}
          className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent"
        >
          ← Challenges
        </Link>
      </div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          {challenge.challenge_name}
        </h1>
        <p className="mt-1 text-sm text-text-muted">Season {challenge.season_number}</p>
      </header>

      <ChallengeEditor challenge={challenge as ChallengeRecord} />

      <div className="max-w-2xl">
        <AdminDeleteButton
          table="challenges"
          id={challenge.id}
          name={challenge.challenge_name ?? "this challenge"}
          redirectTo={`/admin/challenges?season=${challenge.season_number ?? ""}`}
          noun="challenge"
        />
      </div>
    </div>
  );
}
