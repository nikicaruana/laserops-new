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
 * Layout philosophy:
 *   The section is content-driven on desktop, not container-driven.
 *   That is, the cards are sized to the content density they need
 *   rather than each card stretching to fill 1/2 or 2/3 of the row.
 *   Otherwise short content (player name + 3 stat rows) ends up rattling
 *   around inside vast empty cards, with everything hugging edges.
 *
 *   - Outer wrapper: capped at max-w-5xl on desktop so the whole leaders
 *     block reads as a focused section, not a full-bleed banner.
 *   - Leader card: capped at a reasonable content width, content sits
 *     naturally with sensible gaps. NOT flex-1 of the parent row.
 *   - Supporting cards: stack BELOW the leader on desktop (full width
 *     of the wrapper) so their internal layout doesn't have to compete
 *     with a sibling card's width. Two side-by-side small cards beneath
 *     the leader works for desktop. On mobile everything stacks
 *     vertically as before.
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

  const challengeData = await fetchSeasonChallenges(activeSeason, [featuredChallenge]);
  const entries = challengeData[0]?.entries.slice(0, desiredCount) ?? [];
  if (entries.length === 0) return null;

  const [leader, ...supporting] = entries;
  const metricLabel = metricLabelFor(featuredChallenge.metric);

  return (
    <section className="border-t border-border bg-bg">
      <Container className="py-16 sm:py-24">
        {/* Section header.
            Note: we deliberately don't render the challenge's CMS
            `description` here. That field describes the prize-winning
            criteria ("by the end of the season...") which is the right
            framing for the Challenges page. The homepage is a "current
            standings" snapshot, so the copy is forward-looking instead
            — describing the ranking the user is looking at right now. */}
        <div className="text-center">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-accent">
            {activeSeason.name} · Leaders
          </p>
          <h2 className="mt-2 text-3xl font-extrabold uppercase tracking-tight sm:text-4xl">
            Top of the {featuredChallenge.name} ladder
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-text-muted sm:text-base">
            {homepageSubtitleFor(featuredChallenge.metric, entries.length)}
          </p>
        </div>

        {/* Cards layout.
            Outer wrapper: max-w-3xl centers the whole card stack on
            wide screens — without this, cards stretch to the full
            Container width and content rattles inside vast empty space.
            mx-auto centers within the parent. */}
        <div className="mx-auto mt-10 flex max-w-3xl flex-col gap-3 sm:gap-4">
          {/* Leader card — full width of the constrained wrapper. */}
          <LeaderCard entry={leader} metricLabel={metricLabel} />

          {/* Supporting cards.
              On mobile: stack vertically (one per row).
              Desktop: 2-column grid so two #2 cards (or #2 and #3) sit
              side-by-side beneath the leader. If only one supporting
              card, it takes the left column and a faint placeholder
              wouldn't help — single card just spans the row width. */}
          {supporting.length > 0 && (
            <div
              className={cn(
                "grid gap-3 sm:gap-4",
                supporting.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2",
              )}
            >
              {supporting.map((entry) => (
                <SupportingCard
                  key={`${entry.rank}-${entry.nickname}`}
                  entry={entry}
                  metricLabel={metricLabel}
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
    <div className="relative border border-accent bg-bg-elevated p-5 sm:p-6">
      {/* Yellow corner accent — corner brackets like the BracketFrame
          treatment elsewhere on the site. Pure decoration, hides on
          very small viewports to reduce visual noise. */}
      <span aria-hidden className="absolute left-0 top-0 hidden h-6 w-6 border-l-[3px] border-t-[3px] border-accent sm:block" />
      <span aria-hidden className="absolute right-0 top-0 hidden h-6 w-6 border-r-[3px] border-t-[3px] border-accent sm:block" />
      <span aria-hidden className="absolute bottom-0 left-0 hidden h-6 w-6 border-b-[3px] border-l-[3px] border-accent sm:block" />
      <span aria-hidden className="absolute bottom-0 right-0 hidden h-6 w-6 border-b-[3px] border-r-[3px] border-accent sm:block" />

      {/* Layout: photo on left, stats on right.
          Mobile: stack vertically, photo + everything centered.
          Desktop: row layout, photo + stats sit close together with
          a sensible gap. NO flex-1 absorbing extra space — the row
          stays compact, content sits to the left of the card with
          calm breathing room to the right. */}
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
        <img
          src={entry.profilePicUrl}
          alt={`${entry.nickname} profile photo`}
          loading="lazy"
          decoding="async"
          className="block aspect-square w-32 shrink-0 object-cover sm:w-36"
        />

        {/* Stats column.
            Mobile: centered alignment. Desktop: left-aligned but the
            column is content-width (no flex-1) so "left-aligned" reads
            naturally adjacent to the photo. */}
        <div className="flex flex-col items-center gap-3 sm:items-start">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-accent">
            #1 · Season Leader
          </p>
          <h3 className="text-2xl font-extrabold leading-tight text-text [overflow-wrap:anywhere] sm:text-3xl">
            {entry.nickname}
          </h3>

          {/* Rank badge + level row */}
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

          {/* Metric value */}
          <div className="flex flex-col gap-0.5">
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
    // Layout: photo + stats + badge sit together with consistent gaps.
    // The middle stats column has min-w-0 so it can shrink with long
    // nicknames; no flex-1 anywhere so the elements don't get pushed
    // to opposite edges of a wide card.
    <div className="flex items-center gap-3 border border-border bg-bg-elevated p-3 sm:p-4">
      <img
        src={entry.profilePicUrl}
        alt={`${entry.nickname} profile photo`}
        loading="lazy"
        decoding="async"
        className="block aspect-square w-14 shrink-0 object-cover sm:w-16"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
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

/**
 * Forward-looking subtitle copy for the homepage Season Leaders section.
 * Describes the ranking as it stands right now ("currently this season")
 * rather than the prize criteria (which lives in the CMS description and
 * surfaces on the Challenges page).
 *
 * Per-metric variants so the language reads naturally regardless of
 * which challenge is featured. The count is parameterised so the copy
 * matches whatever homepage_season_leaders_count is set to in
 * Site_Config — change "2" to "3" there and the copy follows.
 */
function homepageSubtitleFor(metric: string, count: number): string {
  switch (metric) {
    case "XP_Total":
      return `The ${count} players with the highest rank / most XP currently this season.`;
    case "Rounds_Won":
      return `The ${count} players with the most round wins currently this season.`;
    case "Matches_Won":
      return `The ${count} players with the most match wins currently this season.`;
    case "Total_Points":
      return `The ${count} players with the most total points currently this season.`;
    case "PlayerFragsCount":
      return `The ${count} players with the most kills in a single match this season.`;
    default:
      return "The current top performers this season.";
  }
}

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
