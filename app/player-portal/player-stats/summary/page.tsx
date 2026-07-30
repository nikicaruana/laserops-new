/**
 * app/player-portal/player-stats/summary/page.tsx
 * --------------------------------------------------------------------
 * Player Summary — now sourced from Supabase (was Google Sheets).
 *
 * Reads ?ops= server-side and fetches that one player's synthetic stats row
 * from the read-models (getPlayerSummaryRow), then renders the existing
 * summary projection + section components unchanged. Stats are per-match;
 * ratings are numeric stars encoded for the star animation. Changing the
 * search box's ?ops re-renders this server component and re-fetches.
 *
 * The Compare page still uses the Sheets path — untouched.
 */
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPlayerSummaryRow } from "@/lib/player-stats/supabase-summary";
import { projectSummaryTop } from "@/lib/player-stats/summary-top";
import { ProfileCard } from "@/components/portal/player-summary/ProfileCard";
import { LevelCard } from "@/components/portal/player-summary/LevelCard";
import { FavouriteWeaponCard } from "@/components/portal/player-summary/FavouriteWeaponCard";
import { StatsSection } from "@/components/portal/player-summary/StatsSection";
import { AccoladesSection } from "@/components/portal/player-summary/AccoladesSection";
import { CollapsibleSection } from "@/components/portal/CollapsibleSection";
import { InstallAppButton } from "@/components/portal/AddToHomeScreen";

export const metadata: Metadata = {
  title: "Summary",
};

export default async function PlayerSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ ops?: string }>;
}) {
  const { ops } = await searchParams;
  const opsTag = (ops ?? "").trim();

  const supabase = await createClient();
  const result = opsTag ? await getPlayerSummaryRow(supabase, opsTag) : null;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-4 flex justify-end sm:hidden">
        <InstallAppButton />
      </div>

      {opsTag === "" && <SearchPrompt />}
      {opsTag !== "" && !result && <PlayerNotFound opsTag={opsTag} />}
      {result && (
        <SummaryBody
          top={projectSummaryTop(result.row)}
          row={result.row}
          ratingUnlocked={result.ratingUnlocked}
        />
      )}
    </div>
  );
}

function SummaryBody({
  top,
  row,
  ratingUnlocked,
}: {
  top: ReturnType<typeof projectSummaryTop>;
  row: Parameters<typeof StatsSection>[0]["row"];
  ratingUnlocked: boolean;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-12 sm:gap-5">
        <div className="sm:col-span-5">
          <ProfileCard
            nickname={top.nickname}
            profilePicUrl={top.profilePicUrl}
            overallRatingImageUrl={top.overallRatingImageUrl}
            ratingUnlocked={ratingUnlocked}
          />
        </div>
        <div className="flex flex-col gap-4 sm:col-span-7 sm:gap-5">
          <LevelCard
            rankBadgeUrl={top.rankBadgeUrl}
            levelDisplay={top.levelDisplay}
            matchesPlayed={top.matchesPlayed}
            totalXp={top.totalXp}
            levelProgressPct={top.levelProgressPct}
          />
          <FavouriteWeaponCard
            weaponName={top.favouriteGun}
            imageUrl={top.favouriteGunImageUrl}
          />
        </div>
      </div>

      <div className="mt-2">
        <CollapsibleSection title="Stats">
          <StatsSection row={row} ratingUnlocked={ratingUnlocked} />
        </CollapsibleSection>
      </div>
      <CollapsibleSection title="Accolades">
        <AccoladesSection row={row} />
      </CollapsibleSection>
    </>
  );
}

function SearchPrompt() {
  return (
    <div className="border border-border bg-bg-elevated px-6 py-12 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
        Enter an ops tag to view stats
      </p>
      <p className="mt-2 text-sm text-text-subtle">
        Start typing in the search field above — suggestions will appear.
      </p>
    </div>
  );
}

function PlayerNotFound({ opsTag }: { opsTag: string }) {
  return (
    <div className="border border-border bg-bg-elevated px-6 py-12 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
        No stats found
      </p>
      <p className="mt-2 text-sm text-text-subtle">
        We don&apos;t have any games recorded for &ldquo;{opsTag}&rdquo; yet. Check the spelling or
        pick from the suggestions in the search field.
      </p>
    </div>
  );
}
