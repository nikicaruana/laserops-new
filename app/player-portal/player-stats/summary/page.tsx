/**
 * app/player-portal/player-stats/summary/page.tsx
 * --------------------------------------------------------------------
 * Player Summary – now sourced from Supabase (was Google Sheets).
 *
 * Reads ?ops= server-side and fetches that one player's synthetic stats row
 * from the read-models (getPlayerSummaryRow), then renders the existing
 * summary projection + section components unchanged. Stats are per-match;
 * ratings are numeric stars encoded for the star animation. Changing the
 * search box's ?ops re-renders this server component and re-fetches.
 *
 * The Compare page still uses the Sheets path – untouched.
 */
import type { Metadata } from "next";
import { cldImage } from "@/lib/cld";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FollowButton } from "@/components/portal/FollowButton";
import { InviteToSquadButton } from "@/components/portal/InviteToSquadButton";
import { getPlayerSummaryRow } from "@/lib/player-stats/supabase-summary";
import { projectSummaryTop } from "@/lib/player-stats/summary-top";
import { ProfileCard } from "@/components/portal/player-summary/ProfileCard";
import { LevelCard } from "@/components/portal/player-summary/LevelCard";
import { FavouriteWeaponCard } from "@/components/portal/player-summary/FavouriteWeaponCard";
import { StatsSection } from "@/components/portal/player-summary/StatsSection";
import { AccoladesSection } from "@/components/portal/player-summary/AccoladesSection";
import { CollapsibleSection } from "@/components/portal/CollapsibleSection";
import { InstallAppButton } from "@/components/portal/AddToHomeScreen";
import { fetchPlayerTaggedPhotos, type PlayerTaggedPhoto } from "@/lib/match-photos";
import { FollowersLine } from "@/components/portal/FollowersLine";
import { TaggedPhotosGrid } from "@/components/portal/TaggedPhotosGrid";
import { StreaksSection, type StreakItem } from "@/components/portal/player-summary/StreaksSection";
import { MasterySection } from "@/components/portal/player-summary/MasterySection";
import { getWeaponMasteryByGun, type GunMastery } from "@/lib/weapons/mastery";

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

  // Social: follower count + their squads (the Follow button loads its own state)
  // + photos the player is tagged in (fills out the section).
  let social: Social | null = null;
  let squads: SquadChip[] = [];
  let photos: PlayerTaggedPhoto[] = [];
  let streaks: StreakItem[] = [];
  let masteryGuns: GunMastery[] = [];
  if (result) {
    const [{ data: socialRows }, { data: squadRows }, taggedPhotos, { data: streakDefs }, { data: streakEarned }] = await Promise.all([
      supabase.rpc("player_social", { p_ops_tag: opsTag }),
      supabase.rpc("player_squads", { p_ops_tag: opsTag }),
      fetchPlayerTaggedPhotos(supabase, opsTag, 24),
      supabase.from("streak_definitions").select("streak_key, name, description, badge_url, tier").eq("is_active", true).order("tier", { ascending: false }).order("name"),
      supabase.from("v_hof_streak_leaders").select("streak_key, times_earned").eq("ops_tag", opsTag),
    ]);
    social = ((socialRows ?? []) as Social[])[0] ?? null;
    squads = (squadRows ?? []) as SquadChip[];
    photos = taggedPhotos;
    const earnedMap = new Map<string, number>();
    for (const r of (streakEarned ?? []) as { streak_key: string; times_earned: number }[]) earnedMap.set(r.streak_key, Number(r.times_earned) || 0);
    streaks = ((streakDefs ?? []) as { streak_key: string; name: string; description: string | null; badge_url: string | null; tier: number }[]).map((d) => ({
      streakKey: d.streak_key, name: d.name, description: d.description, badgeUrl: d.badge_url, tier: d.tier, count: earnedMap.get(d.streak_key) ?? 0,
    }));
    masteryGuns = Array.from((await getWeaponMasteryByGun(supabase, opsTag, true)).values());
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>{result && <FollowButton opsTag={opsTag} />}</div>
        <div className="sm:hidden">
          <InstallAppButton />
        </div>
      </div>

      {opsTag === "" && <SearchPrompt />}
      {opsTag !== "" && !result && <PlayerNotFound opsTag={opsTag} />}
      {result && (
        <SummaryBody
          top={projectSummaryTop(result.row)}
          row={result.row}
          accolades={result.accolades}
          ratingUnlocked={result.ratingUnlocked}
          opsTag={opsTag}
          social={social}
          squads={squads}
          photos={photos}
          streaks={streaks}
          masteryGuns={masteryGuns}
        />
      )}
    </div>
  );
}

type Social = { account_id: string; follower_count: number; is_following: boolean; is_self: boolean };
type SquadChip = { squad_id: string; name: string; badge_url: string | null; is_primary: boolean; role: string | null };

const ROLE_LABEL: Record<string, string> = { captain: "Captain", officer: "Officer", member: "Member" };

function SquadsSection({ opsTag, squads }: { opsTag: string; squads: SquadChip[] }) {
  return (
    <div className="space-y-5 portal-card p-5">
      {squads.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {squads.map((s) => (
            <li key={s.squad_id}>
              <Link
                href={`/player-portal/squads/${s.squad_id}`}
                className="flex items-center gap-4 border border-border-strong bg-bg p-3 transition-colors hover:border-accent"
              >
                {/* Squad logos stay circular. */}
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-bg-overlay text-sm font-bold text-text-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {s.badge_url ? <img src={cldImage(s.badge_url, { w: 384 })} alt="" className="h-full w-full object-cover" /> : s.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2">
                    <span className="truncate text-base font-bold text-text">{s.name}</span>
                    {s.is_primary && (
                      <span className="shrink-0 border border-accent/50 bg-accent/10 px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-[0.1em] text-accent">
                        Primary
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">{s.role ? ROLE_LABEL[s.role] ?? s.role : "Member"}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-subtle">Not in a squad yet.</p>
      )}

      <InviteToSquadButton opsTag={opsTag} />
    </div>
  );
}

function SummaryBody({
  top,
  row,
  accolades,
  ratingUnlocked,
  opsTag,
  social,
  squads,
  photos,
  streaks,
  masteryGuns,
}: {
  top: ReturnType<typeof projectSummaryTop>;
  row: Parameters<typeof StatsSection>[0]["row"];
  accolades: Parameters<typeof AccoladesSection>[0]["data"];
  ratingUnlocked: boolean;
  opsTag: string;
  social: Social | null;
  squads: SquadChip[];
  photos: PlayerTaggedPhoto[];
  streaks: StreakItem[];
  masteryGuns: GunMastery[];
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
            followersSlot={<FollowersLine opsTag={opsTag} count={social?.follower_count ?? 0} />}
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
        <CollapsibleSection title="Squads">
          <SquadsSection opsTag={opsTag} squads={squads} />
        </CollapsibleSection>
      </div>
      <CollapsibleSection title="Stats">
        <StatsSection row={row} ratingUnlocked={ratingUnlocked} />
      </CollapsibleSection>
      <CollapsibleSection title="Photos">
        <TaggedPhotosGrid photos={photos} opsTag={opsTag} limit={6} />
      </CollapsibleSection>
      <CollapsibleSection title="Accolades">
        <AccoladesSection data={accolades} />
      </CollapsibleSection>
      <CollapsibleSection title="Streaks">
        <StreaksSection streaks={streaks} />
      </CollapsibleSection>
      <CollapsibleSection title="Mastery">
        <MasterySection guns={masteryGuns} />
      </CollapsibleSection>
    </>
  );
}

function SearchPrompt() {
  return (
    <div className="portal-card px-6 py-12 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
        Enter an ops tag to view stats
      </p>
      <p className="mt-2 text-sm text-text-subtle">
        Start typing in the search field above – suggestions will appear.
      </p>
    </div>
  );
}

function PlayerNotFound({ opsTag }: { opsTag: string }) {
  return (
    <div className="portal-card px-6 py-12 text-center">
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
