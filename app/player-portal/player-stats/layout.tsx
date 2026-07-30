import { createClient } from "@/lib/supabase/server";
import { listSupabaseNicknames } from "@/lib/player-stats/supabase-summary";
import { PlayerStatsShell } from "@/components/portal/PlayerStatsShell";

/**
 * Player Stats layout.
 *
 * Provides the known-player nickname list (from Supabase now) so the search
 * bar rendered by PlayerStatsShell has autocomplete suggestions immediately.
 * Aligned with the Summary page's Supabase source; the not-yet-migrated
 * sub-pages (History / Armory / Last Match / Compare) still read Sheets.
 *
 * The shell is a client component that:
 *   - Always shows the PlayerSearch bar (search first, then browse tabs)
 *   - Shows the SubTabs row only once a valid player is selected via ?ops=
 */
export default async function PlayerStatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const knownNicknames = await listSupabaseNicknames(supabase);

  return (
    <PlayerStatsShell knownNicknames={knownNicknames}>
      {children}
    </PlayerStatsShell>
  );
}
