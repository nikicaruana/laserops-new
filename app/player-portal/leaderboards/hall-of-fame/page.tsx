import type { Metadata } from "next";
import { DashboardPageHeader } from "@/components/portal/DashboardPageHeader";
import { HallOfFameTabs } from "@/components/portal/hall-of-fame/HallOfFameTabs";
import { SeasonChampionsSection } from "@/components/portal/hall-of-fame/SeasonChampionsSection";
import { AllTimeRecordsSection } from "@/components/portal/hall-of-fame/AllTimeRecordsSection";
import { WeaponMastersSection } from "@/components/portal/hall-of-fame/WeaponMastersSection";
import {
  fetchHallOfFameChampions,
  fetchAllTimeRecords,
  fetchWeaponMasters,
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
export default async function HallOfFameLeaderboardPage() {
  const [champions, allTimeRecords, weaponMasters] = await Promise.all([
    fetchHallOfFameChampions(),
    fetchAllTimeRecords(),
    fetchWeaponMasters(),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <DashboardPageHeader title="Hall of Fame" hideAddToHome />
      <HallOfFameTabs
        labels={["Season Champions", "All-Time Records", "Weapon Masters"]}
      >
        <SeasonChampionsSection seasons={champions} />
        <AllTimeRecordsSection categories={allTimeRecords} />
        <WeaponMastersSection weapons={weaponMasters} />
      </HallOfFameTabs>
    </div>
  );
}
