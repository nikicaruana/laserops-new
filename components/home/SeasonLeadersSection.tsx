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
 * Driven by the CMS (Seasons + Challenges + Site_Config).
 *
 * Layout strategy: separate mobile and desktop layouts because the two
 * viewports have fundamentally different design priorities:
 *
 *   - Mobile: cards stack vertically, each card uses a horizontal
 *     INNER layout (photo on left, stats on right). Works because
 *     narrow viewports naturally constrain horizontal space — no voids.
 *
 *   - Desktop (lg+): cards sit SIDE-BY-SIDE in a single row, leader
 *     wider than supporting (~60/40 split). Each card uses a vertical
 *     INNER layout (photo on top, stats below). This sidesteps the
 *     "wide card with sparse horizontal content" problem — content
 *     stacks naturally without trying to fill arbitrary horizontal
 *     space.
 *
 * Implementation: each card component renders its mobile layout by
 * default and switches to a vertical layout at lg+. Tailwind's
 * responsive utilities handle the swap without duplicating components.
 */

export async function SeasonLeadersSection() {
  // Site config gates the section entirely.
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

  const featuredChallenge = challenges[0];

  const challengeData = await fetchSeasonChallenges(activeSeason, [featuredChallenge]);
  const entries = challengeData[0]?.entries.slice(0, desiredCount) ?? [];
  if (entries.length === 0) return null;

  const [leader, ...supporting] = entries;
  const metricLabel = metricLabelFor(featuredChallenge.metric);

  return (
    <section className="border-t border-border bg-bg">
      {/* Asymmetric padding: more space at top (separates from Weapons
          section above), less at bottom (Gallery is conceptually a
          continuation, so keep the gap to the next section tight). */}
      <Container className="pb-10 pt-16 sm:pb-14 sm:pt-24">
        {/* Section header. CMS description is intentionally NOT used —
            see homepageSubtitleFor() for the rationale. */}
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

        {/* Cards row.
            Mobile (default): single column, leader stacked above supporting cards.
            Desktop (lg+): grid with leader getting more space than supporting.
            With 2 entries: 60/40 split (3fr 2fr).
            With 3+ entries: leader takes left half, supporting cards stack
            in a right column at smaller scale. */}
        <div
          className={cn(
            "mx-auto mt-10 grid gap-4 lg:gap-5",
            // Mobile: always single column
            "max-w-md sm:max-w-2xl lg:max-w-5xl",
            // Desktop: leader on left, supporting on right
            supporting.length === 0
              ? "lg:grid-cols-1"
              : "lg:grid-cols-[3fr_2fr]",
          )}
        >
          <LeaderCard entry={leader} metricLabel={metricLabel} />

          {supporting.length > 0 && (
            // Supporting cards container — single column on mobile (already
            // stacked from parent grid), still single column on desktop
            // because they sit BESIDE the leader card and stack vertically
            // within their own narrower column.
            <div className="flex flex-col gap-4 lg:gap-5">
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

/* ============================================================
   Leader card (rank 1)
   ============================================================ */

type CardProps = {
  entry: ChallengeEntry;
  metricLabel: string;
};

/**
 * LeaderCard — the rank-1 player.
 *
 * Mobile: horizontal inner layout (photo on left, stats on right).
 * Desktop (lg+): vertical inner layout (photo on top, stats below,
 *   centered). The photo grows to a larger size since it's the
 *   centerpiece. Yellow corner brackets accent the whole card.
 */
function LeaderCard({ entry, metricLabel }: CardProps) {
  return (
    <div className="relative h-full border border-accent bg-bg-elevated p-5 sm:p-6 lg:p-7">
      {/* Yellow corner accent — sm+ only (too noisy on phones). */}
      <span aria-hidden className="absolute left-0 top-0 hidden h-6 w-6 border-l-[3px] border-t-[3px] border-accent sm:block" />
      <span aria-hidden className="absolute right-0 top-0 hidden h-6 w-6 border-r-[3px] border-t-[3px] border-accent sm:block" />
      <span aria-hidden className="absolute bottom-0 left-0 hidden h-6 w-6 border-b-[3px] border-l-[3px] border-accent sm:block" />
      <span aria-hidden className="absolute bottom-0 right-0 hidden h-6 w-6 border-b-[3px] border-r-[3px] border-accent sm:block" />

      {/* Inner layout.
          Mobile/tablet: flex-row, photo on left, stats on right.
          Desktop (lg+): flex-col, everything centered vertically. */}
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7 lg:flex-col lg:gap-6">
        {/* Photo — fixed sizes per breakpoint. On desktop it gets bigger
            since it's now the visual centerpiece of a vertical layout. */}
        <img
          src={entry.profilePicUrl}
          alt={`${entry.nickname} profile photo`}
          loading="lazy"
          decoding="async"
          className="block aspect-square w-32 shrink-0 object-cover sm:w-36 lg:w-48"
        />

        {/* Stats column.
            Mobile-tablet (sm): items-start (text reads left-aligned next to photo).
            Desktop (lg+): items-center (text reads centered below the photo). */}
        <div className="flex flex-col items-center gap-3 sm:items-start lg:items-center">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-accent">
            #1 · Season Leader
          </p>
          <h3 className="text-2xl font-extrabold leading-tight text-text [overflow-wrap:anywhere] sm:text-3xl lg:text-center">
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

          {/* Metric. Center-aligned on desktop to match the vertical layout. */}
          <div className="flex flex-col gap-0.5 sm:items-start lg:items-center">
            <span className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-text-subtle">{metricLabel}</span>
            <span className="font-mono text-2xl font-bold tabular-nums text-accent sm:text-3xl lg:text-4xl">
              {entry.metricValue.toLocaleString("en-US")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Supporting card (rank 2+)
   ============================================================ */

/**
 * SupportingCard — rank-2-and-beyond players.
 *
 * Mobile: horizontal inner layout — photo on left, name+stats in middle,
 *   badge on the right. Compact, single-line summary feel.
 * Desktop (lg+): vertical inner layout — photo on top, then name + rank,
 *   stats, badge below. Same vertical motif as the leader card so they
 *   visually rhyme, just at smaller scale.
 */
function SupportingCard({ entry, metricLabel }: CardProps) {
  return (
    // h-full lets this card stretch to match the leader card's height
    // on desktop. The two layouts (mobile row, desktop column) are
    // rendered as separate sub-trees rather than reflowed via flex
    // direction switches — clearer, less fragile.
    <div className="border border-border bg-bg-elevated p-3 sm:p-4 lg:h-full lg:p-5">
      {/* === Mobile / tablet layout: horizontal row ============== */}
      <div className="flex items-center gap-3 lg:hidden">
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
          <p className="truncate text-base font-extrabold text-text [overflow-wrap:anywhere] sm:text-lg">
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

      {/* === Desktop layout: vertical column with content centered.
            justify-center keeps the content cluster in the middle of
            the card with empty space distributed equally above and below.
            Earlier iteration used justify-between which produced large
            voids between groups when content was sparse — center
            distribution looks calmer for a card that's intentionally
            shorter on content than the leader. */}
      <div className="hidden h-full flex-col items-center justify-center gap-6 lg:flex">
        <div className="flex flex-col items-center gap-3">
          <img
            src={entry.profilePicUrl}
            alt={`${entry.nickname} profile photo`}
            loading="lazy"
            decoding="async"
            className="block aspect-square w-28 object-cover"
          />
          <div className="flex flex-col items-center text-center">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-text-subtle">
              #{entry.rank}
            </p>
            <p className="text-xl font-extrabold text-text [overflow-wrap:anywhere]">
              {entry.nickname}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          {entry.rankBadgeUrl !== "" && (
            <img
              src={entry.rankBadgeUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="block h-14 w-auto"
            />
          )}
          <div className="flex flex-col items-center">
            <span className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-text-subtle">
              {metricLabel}
            </span>
            <span className="font-mono text-2xl font-bold tabular-nums text-accent">
              {entry.metricValue.toLocaleString("en-US")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Helpers
   ============================================================ */

/**
 * Forward-looking subtitle copy for the homepage Season Leaders section.
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
