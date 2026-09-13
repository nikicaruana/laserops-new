import { createClient } from "@/lib/supabase/server";
import { ProgressionCalibrator } from "@/components/admin/ProgressionCalibrator";

export const metadata = { title: "Progression · Admin" };

export default async function ProgressionAdminPage() {
  const supabase = await createClient();
  const [{ data: cfg }, { data: levels }, { data: rows }, { data: matchesRaw }] = await Promise.all([
    supabase.from("xp_config").select("key, value"),
    supabase.from("rank_levels").select("level, rank_name, score_threshold").order("level"),
    supabase.from("match_player_aggregate").select("account_id, nickname, match_id, score, rounds_won, was_winner, xp_from_accolades, xp_multiplier, xp_total"),
    supabase.from("matches").select("id, is_double_xp"),
  ]);
  // A match-wide Double XP night counts as a 2x multiplier for everyone in it.
  const doubleXpMatches = new Set((matchesRaw ?? []).filter((m) => m.is_double_xp).map((m) => m.id as string));
  const enrichedRows = (rows ?? []).map((r) => ({ ...r, is_double_xp: doubleXpMatches.has(r.match_id as string) }));
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Progression Calibrator</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          Model the XP formula and level curve against every real game, then publish &amp; recompute the whole playerbase.
          Sliders only preview &mdash; nothing changes for players until you publish (2FA).
        </p>
      </header>
      <ProgressionCalibrator config={cfg ?? []} levels={levels ?? []} rows={enrichedRows as never[]} />
    </div>
  );
}
