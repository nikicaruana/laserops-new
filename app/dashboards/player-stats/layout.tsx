import { SubTabs } from "@/components/dashboards/SubTabs";

const playerStatsSubTabs = [
  { label: "Summary", href: "/dashboards/player-stats/summary" },
  { label: "History", href: "/dashboards/player-stats/history" },
  { label: "Armory", href: "/dashboards/player-stats/armory" },
];

export default function PlayerStatsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubTabs tabs={playerStatsSubTabs} />
      <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
        {children}
      </div>
    </>
  );
}
