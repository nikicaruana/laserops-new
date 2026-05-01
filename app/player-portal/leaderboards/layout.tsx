import { SubTabs } from "@/components/portal/SubTabs";

/**
 * Leaderboards section layout — adds the subtab row for global leaderboard pages.
 *
 * The content area below the subtabs uses a max-width container with px-4 on
 * mobile (matching the DashboardFrame's -mx-4 bleed math). Padding scales
 * up at sm/lg breakpoints.
 */

const leaderboardsSubTabs = [
  { label: "All Time", href: "/player-portal/leaderboards/all-time" },
  { label: "Challenges", href: "/player-portal/leaderboards/challenges" },
  { label: "Hall of Fame", href: "/player-portal/leaderboards/hall-of-fame" },
];

export default function LeaderboardsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubTabs tabs={leaderboardsSubTabs} />
      <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
        {children}
      </div>
    </>
  );
}
