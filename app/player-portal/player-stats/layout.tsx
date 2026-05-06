import {
  fetchAllPlayerStats,
  listAllNicknames,
} from "@/lib/player-stats/shared";
import { PlayerStatsShell } from "@/components/portal/PlayerStatsShell";

/**
 * Player Stats layout.
 *
 * Fetches the list of known player nicknames (cached 5min) so the search
 * bar rendered by PlayerStatsShell has autocomplete suggestions available
 * immediately — no client-side fetch needed.
 *
 * The shell is a client component that:
 *   - Always shows the PlayerSearch bar (search first, then browse tabs)
 *   - Shows the SubTabs row (Summary / History / Armory / Last Match)
 *     only once a valid player is selected via ?ops=
 */
export default async function PlayerStatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await fetchAllPlayerStats();
  const knownNicknames = result.ok ? listAllNicknames(result.rows) : [];

  return (
    <PlayerStatsShell knownNicknames={knownNicknames}>
      {children}
    </PlayerStatsShell>
  );
}
