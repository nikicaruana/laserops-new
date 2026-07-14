import type { Metadata } from "next";
import { DashboardPageHeader } from "@/components/portal/DashboardPageHeader";
import { HallOfFameTabs } from "@/components/portal/hall-of-fame/HallOfFameTabs";
import { SeasonChampionsSection } from "@/components/portal/hall-of-fame/SeasonChampionsSection";
import { AllTimeRecordsSection } from "@/components/portal/hall-of-fame/AllTimeRecordsSection";
import { WeaponMastersSection } from "@/components/portal/hall-of-fame/WeaponMastersSection";
import { AccoladeLeadersSection } from "@/components/portal/hall-of-fame/AccoladeLeadersSection";
import {
  fetchHallOfFameChampions,
  fetchAllTimeRecords,
  fetchWeaponMasters,
  fetchAccoladeLeaders,
} from "@/lib/leaderboards/hall-of-fame";

export const metadata: Metadata = {
  title: "Hall of Fame",
};

/**
 * Hall of Fame — three tabbed sections:
 *   1. Season Champions — top 2 of each challenge in completed seasons
 *   2. All-Time Records — single-game bests across every match
 *   3. Weapon Masters — career master + single-game records per gun
 *
 * All data is fetched server-side here (each fetch is cached at the
 * sheet layer); the tab wrapper only toggles visibility client-side.
 */
export default async function HallOfFameLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  // Each fetch throws (rather than caching an empty result) if its source sheet
  // is temporarily unavailable. Catch per-section so one flaky dataset shows its
  // own empty state instead of failing the whole page — and because the throw
  // wasn't cached, the next visit retries and self-heals.
  const [champions, allTimeRecords, weaponMasters, accoladeLeaders] =
    await Promise.all([
      fetchHallOfFameChampions().catch(() => []),
      fetchAllTimeRecords().catch(() => []),
      fetchWeaponMasters().catch(() => []),
      fetchAccoladeLeaders().catch(() => []),
    ]);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <DashboardPageHeader title="Hall of Fame" hideAddToHome />
      <HallOfFameTabs
        labels={[
          "Season Champions",
          "All-Time Records",
          "Weapon Masters",
          "Accolade Leaders",
        ]}
        initialSlug={tab}
      >
        <SeasonChampionsSection seasons={champions} />
        <AllTimeRecordsSection categories={allTimeRecords} />
        <WeaponMastersSection weapons={weaponMasters} />
        <AccoladeLeadersSection accolades={accoladeLeaders} />
      </HallOfFameTabs>
    </div>
  );
}
