import { SubTabs } from "@/components/portal/SubTabs";

const playerStatsSubTabs = [
  { label: "Summary", href: "/player-portal/player-stats/summary" },
  { label: "History", href: "/player-portal/player-stats/history" },
  { label: "Armory", href: "/player-portal/player-stats/armory" },
];

export default function PlayerStatsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* forwardParams={["ops"]} — keep the selected player (?ops=)
          when the user clicks between Summary / History / Armory.
          Without this, jumping from Summary to History drops the
          query string and the user lands on an empty search state. */}
      <SubTabs tabs={playerStatsSubTabs} forwardParams={["ops"]} />
      <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
        {children}
      </div>
    </>
  );
}
