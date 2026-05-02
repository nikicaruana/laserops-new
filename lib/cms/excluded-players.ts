import { fetchSheetAsObjects } from "@/lib/sheets";
import { CMS_REVALIDATE_SECONDS, CMS_URLS } from "./client";

/**
 * lib/cms/excluded-players.ts
 * --------------------------------------------------------------------
 * "Prize-ineligible" players list. These nicknames are filtered out of
 * any surface that determines prize-winning rankings:
 *
 *   - Season challenges (lib/leaderboards/season-challenges.ts)
 *   - Homepage Season Leaders (components/home/SeasonLeadersSection.tsx)
 *
 * NOT applied to general leaderboards (all-time XP, all-time scores,
 * etc.) — owners and other excluded players still show on those for
 * pride and visibility. The naming "prize-ineligible" rather than
 * "hidden" / "banned" reflects this product semantic.
 *
 * The list is checked case-insensitively against trimmed nicknames,
 * matching how findPlayerByOpsTag in lib/player-stats/shared.ts works.
 */

type ExcludedPlayerRaw = Record<string, string> & {
  Nickname: string;
  Reason: string;
  Status: string;
};

/**
 * Fetch the set of prize-ineligible nicknames. Returned as a Set with
 * lowercase trimmed keys for direct membership checks.
 *
 * Only rows with Status === "active" are included; this lets editors
 * disable an exclusion without deleting the row (history preserved).
 */
export async function fetchExcludedNicknames(): Promise<Set<string>> {
  const result = await fetchSheetAsObjects<ExcludedPlayerRaw>(
    CMS_URLS.excludedPlayers,
    CMS_REVALIDATE_SECONDS,
  );
  if (!result.ok) {
    return new Set();
  }

  const set = new Set<string>();
  for (const row of result.rows) {
    const status = (row.Status ?? "").trim().toLowerCase();
    if (status !== "active") continue;
    const nickname = (row.Nickname ?? "").trim().toLowerCase();
    if (nickname === "") continue;
    set.add(nickname);
  }
  return set;
}

/**
 * Convenience: returns true if the nickname is in the excluded set.
 * Handles trim + case-folding so callers don't have to.
 */
export function isPrizeIneligible(
  nickname: string,
  excluded: Set<string>,
): boolean {
  return excluded.has(nickname.trim().toLowerCase());
}
