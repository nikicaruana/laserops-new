import { ChallengeBlock } from "./ChallengeBlock";
import type { Season } from "@/lib/cms/seasons";
import type { ChallengeWithEntries } from "@/lib/leaderboards/season-challenges";

/**
 * SeasonalChallengesView
 * --------------------------------------------------------------------
 * Top-level layout for the Challenges leaderboard tab. Shows the active
 * season's name and date range, lists each challenge as a collapsible
 * block, and renders the season-wide Terms & Conditions at the bottom.
 *
 * If a future season has no challenges defined, the empty array is
 * passed and the section renders an empty state. We don't hide the page
 * entirely — it'd be confusing for users who navigated to /challenges
 * to see nothing at all.
 */

type SeasonalChallengesViewProps = {
  season: Season | undefined;
  challengeData: ChallengeWithEntries[];
};

export function SeasonalChallengesView({ season, challengeData }: SeasonalChallengesViewProps) {
  if (!season) {
    return (
      <div className="border border-dashed border-border bg-bg-elevated px-6 py-12 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
          No active season
        </p>
        <p className="mt-2 text-xs text-text-subtle">
          The next season will appear here once configured.
        </p>
      </div>
    );
  }

  const dateRange = formatSeasonRange(season.startYearMonth, season.endYearMonth);

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* Season header — just the name + date range. The "Seasonal
          Challenges" title comes from the page header (DashboardPageHeader)
          to avoid duplication. */}
      <header className="text-center">
        <h2 className="text-xl font-extrabold uppercase tracking-tight text-text sm:text-2xl">
          {season.name}
        </h2>
        <p className="mt-1 text-sm text-text-muted">{dateRange}</p>
      </header>

      {/* Challenges list. First challenge starts open; rest start
          closed so the page doesn't scroll forever on first load. */}
      {challengeData.length === 0 ? (
        <div className="border border-dashed border-border bg-bg-elevated px-6 py-12 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
            No challenges configured for this season
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:gap-6">
          {challengeData.map(({ challenge, entries }, idx) => (
            <ChallengeBlock
              key={`${challenge.seasonNumber}-${challenge.challengeNumber}`}
              challenge={challenge}
              entries={entries}
              defaultOpen={idx === 0}
            />
          ))}
        </div>
      )}

      {/* Terms & Conditions */}
      {season.termsAndConditions !== "" && (
        <section className="rounded-sm bg-accent px-4 py-5 text-bg sm:px-6 sm:py-6">
          <h3 className="text-center text-lg font-extrabold uppercase tracking-tight sm:text-xl">
            Terms and Conditions
          </h3>
          {/* whitespace-pre-line preserves the line breaks that editors
              add in the CMS via Alt+Enter, so multi-paragraph T&C reads
              correctly without us having to parse markdown. */}
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed sm:text-base">
            {season.termsAndConditions}
          </p>
        </section>
      )}
    </div>
  );
}

/* ---------- Helpers ---------- */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Format a season's start/end YearMonths as a human range.
 *   "2026-04" + "2026-06" → "April – June 2026"
 *   "2025-12" + "2026-02" → "December 2025 – February 2026"
 */
function formatSeasonRange(start: string, end: string): string {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  const startMonth = MONTH_NAMES[sm - 1] ?? start;
  const endMonth = MONTH_NAMES[em - 1] ?? end;

  if (sy === ey) {
    return `${startMonth} – ${endMonth} ${ey}`;
  }
  return `${startMonth} ${sy} – ${endMonth} ${ey}`;
}
