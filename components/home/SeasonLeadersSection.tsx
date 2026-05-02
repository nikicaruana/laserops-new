import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { fetchSeasons, getActiveSeason } from "@/lib/cms/seasons";
import { fetchChallenges } from "@/lib/cms/challenges";
import { fetchSeasonChallenges, type ChallengeEntry } from "@/lib/leaderboards/season-challenges";
import { fetchSiteConfig, configBool, configInt } from "@/lib/cms/site-config";
import { cn } from "@/lib/cn";

/**
 * SeasonLeadersSection
 * --------------------------------------------------------------------
 * Homepage section showcasing the top players of the current season.
 * Driven by the CMS:
 *   - Active season comes from the Seasons tab
 *   - Number of players to feature comes from Site_Config
 *     (homepage_season_leaders_count, default 2)
 *   - The challenge to rank by is the highest-priority challenge in the
 *     active season — typically the XP challenge for Season 1.
 *
 * The section auto-hides if:
 *   - homepage_show_season_leaders is "false" in Site_Config
 *   - No active season is configured
 *   - No challenges defined for the active season
 *   - Top players list is empty
 *
 * Visual: top-1 prominent (large card, "S1 LEADER" banner, big profile),
 * supporting players (smaller side cards). On mobile the layout stacks.
 *
 * The whole section is a server component — data is fetched at request
 * time with the standard Next.js fetch caching. No client-side JS for
 * the section itself.
 */

export async function SeasonLeadersSection() {
  // Site config gates the section entirely. Quick exits if disabled.
  const config = await fetchSiteConfig();
  if (!configBool(config, "homepage_show_season_leaders", true)) {
    return null;
  }
  const desiredCount = Math.max(1, configInt(config, "homepage_season_leaders_count", 2));

  const seasons = await fetchSeasons();
  const activeSeason = getActiveSeason(seasons);
  if (!activeSeason) return null;

  const challenges = await fetchChallenges(activeSeason.number);
  if (challenges.length === 0) return null;

  // Highest-priority challenge (challenges are already sorted by priority
  // ascending in fetchChallenges). For homepage we feature exactly one
  // challenge — the season's headline. Players who care about other
  // challenges can dig into /player-portal/leaderboards/challenges.
  const featuredChallenge = challenges[0];

  // Compute entries for that one challenge. Cap to the desired count.
  // We intentionally fetch with the natural Top_N from the CMS (e.g. 5)
  // and slice client-side here, so future homepage variants can show
  // more without a CMS edit.
  const challengeData = await fetchSeasonChallenges(activeSeason, [featuredChallenge]);
  const entries = challengeData[0]?.entries.slice(0, desiredCount) ?? [];
  if (entries.length === 0) return null;

  const [leader, ...supporting] = entries;

  return (
    <section className="border-t border-border bg-bg">
      <Container className="py-16 sm:py-24">
        {/* Section header */}
        <div className="text-center">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-accent">
            {activeSeason.name} · Leaders
          </p>
          <h2 className="mt-2 text-3xl font-extrabold uppercase tracking-tight sm:text-4xl">
            Top of the {featuredChallenge.name} ladder
          </h2>
          {featuredChallenge.description !== "" && (
            <p className="mx-auto mt-3 max-w-xl text-sm text-text-muted sm:text-base">
              {featuredChallenge.description}
            </p>
          )}
        </div>

        {/* Leader + supporting cards */}
        <div className="mt-10 flex flex-col items-stretch gap-4 sm:gap-5 lg:flex-row">
          {/* Leader — bigger, more prominent. lg:flex-[2] to grab 2/3 of
              the row when there's a supporting column beside it. */}
          <div className={cn("flex-1", supporting.length > 0 && "lg:flex-[2]")}>
            <LeaderCard entry={leader} metricLabel={metricLabelFor(featuredChallenge.metric)} />
          </div>

          {/* Supporting — stacks vertically inside its own column on
              desktop, horizontally beside the leader. */}
          {supporting.length > 0 && (
            <div className="flex flex-1 flex-col gap-3 sm:gap-4 lg:flex-[1]">
              {supporting.map((entry) => (
                <SupportingCard
                  key={`${entry.rank}-${entry.nickname}`}
                  entry={entry}
                  metricLabel={metricLabelFor(featuredChallenge.metric)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Link out to the full Challenges page */}
        <div className="mt-8 text-center">
          <Link
            href="/player-portal/leaderboards/challenges"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-accent transition-colors hover:text-accent-soft"
          >
            View all season challenges
            <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 6h8M6 2l4 4-4 4" strokeLinecap="square" />
            </svg>
          </Link>
        </div>
      </Container>
    </section>
  );
}

/* ---------- Leader card (rank 1) ---------- */

type CardProps = {
  entry: ChallengeEntry;
  metricLabel: string;
};

function LeaderCard({ entry, metricLabel }: CardProps) {
  return (
    <div className="relative h-full border border-accent bg-bg-elevated p-5 sm:p-7">
      {/* Yellow corner accent — corner brackets like the BracketFrame
          treatment elsewhere on the site. Pure decoration, hides on
          very small viewports to reduce visual noise. */}
      <span aria-hidden className="absolute left-0 top-0 hidden h-6 w-6 border-l-[3px] border-t-[3px] border-accent sm:block" />
      <span aria-hidden className="absolute right-0 top-0 hidden h-6 w-6 border-r-[3px] border-t-[3px] border-accent sm:block" />
      <span aria-hidden className="absolute bottom-0 left-0 hidden h-6 w-6 border-b-[3px] border-l-[3px] border-accent sm:block" />
      <span aria-hidden className="absolute bottom-0 right-0 hidden h-6 w-6 border-b-[3px] border-r-[3px] border-accent sm:block" />

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
        {/* Profile pic — square, large */}
        <img
          src={entry.profilePicUrl}
          alt={`${entry.nickname} profile photo`}
          loading="lazy"
          decoding="async"
          className="block aspect-square w-32 object-cover sm:w-40"
        />

        {/* Stats column */}
        <div className="flex flex-1 flex-col items-center gap-2 sm:items-start">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-accent">
            #1 · Season Leader
          </p>
          <h3 className="text-2xl font-extrabold leading-tight text-text [overflow-wrap:anywhere] sm:text-3xl">
            {entry.nickname}
          </h3>

          <div className="flex items-center gap-3">
            {entry.rankBadgeUrl !== "" && (
              <img
                src={entry.rankBadgeUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="block h-12 w-auto sm:h-14"
              />
            )}
            {entry.level > 0 && (
              <div className="flex flex-col">
                <span className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-text-subtle">Level</span>
                <span className="font-mono text-2xl font-bold tabular-nums text-text sm:text-3xl">{entry.level}</span>
              </div>
            )}
          </div>

          <div className="mt-2 flex flex-col gap-0.5">
            <span className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-text-subtle">{metricLabel}</span>
            <span className="font-mono text-2xl font-bold tabular-nums text-accent sm:text-3xl">
              {entry.metricValue.toLocaleString("en-US")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Supporting card (rank 2+) ---------- */

function SupportingCard({ entry, metricLabel }: CardProps) {
  return (
    <div className="flex h-full items-center gap-4 border border-border bg-bg-elevated p-3 sm:p-4">
      <img
        src={entry.profilePicUrl}
        alt={`${entry.nickname} profile photo`}
        loading="lazy"
        decoding="async"
        className="block aspect-square w-16 shrink-0 object-cover sm:w-20"
      />

      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-text-subtle">
          #{entry.rank}
        </p>
        <p className="truncate text-base font-extrabold text-text sm:text-lg [overflow-wrap:anywhere]">
          {entry.nickname}
        </p>
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-text-subtle">
          {metricLabel}
          <span className="ml-2 font-mono font-bold text-accent">
            {entry.metricValue.toLocaleString("en-US")}
          </span>
        </p>
      </div>

      {entry.rankBadgeUrl !== "" && (
        <img
          src={entry.rankBadgeUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="block h-10 w-auto shrink-0 sm:h-12"
        />
      )}
    </div>
  );
}

/* ---------- Helpers ---------- */

function metricLabelFor(metric: string): string {
  switch (metric) {
    case "XP_Total":
      return "Season XP";
    case "Rounds_Won":
      return "Rounds Won";
    case "Matches_Won":
      return "Matches Won";
    case "Total_Points":
      return "Total Points";
    case "PlayerFragsCount":
      return "Kills";
    default:
      return metric.replace(/_/g, " ");
  }
}
