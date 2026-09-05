/**
 * app/admin/match-report-preview/page.tsx
 * --------------------------------------------------------------------
 * Admin-only design preview of the freshened-up match report, rendered with the
 * REAL report components fed dummy stats but REAL badge/image/accolade/rank
 * assets pulled from the config tables, so it looks like a live report. Clicking
 * a player loads their summary below via ?player=, like the live report.
 */
import { createClient } from "@/lib/supabase/server";
import { buildPreviewReportFromDb } from "@/lib/match-report/preview-report";
import { MatchOverview } from "@/components/match-report/MatchOverview";
import { PlayersTable } from "@/components/match-report/PlayersTable";
import { PlayerStatsCard } from "@/components/match-report/PlayerStatsCard";
import { StoryPreviewGallery } from "@/components/match-report/StoryPreviewGallery";
import { MatchImages, type ReportPhoto } from "@/components/match-report/MatchImages";
import { PlayerNavProvider, PlayerCardArea } from "@/components/match-report/PlayerNav";
import { buildOverlayData } from "@/lib/story/meta";

export const metadata = { title: "Match report preview" };

// Sample photos to exercise the tagging + photo-story share flow without a real
// match. Drop the two files into public/images/samples/ with these exact names.
const SAMPLE_PHOTOS: ReportPhoto[] = [
  { id: "sample-landscape", url: "/images/samples/sample-landscape.jpg", caption: "Sample landscape photo", width: null, height: null, taggedOps: [] },
  { id: "sample-portrait", url: "/images/samples/sample-portrait.jpg", caption: "Sample portrait photo", width: null, height: null, taggedOps: [] },
];

export default async function MatchReportPreviewPage({ searchParams }: { searchParams: Promise<{ player?: string }> }) {
  const { player } = await searchParams;
  const selected = (player ?? "").trim();

  const report = await buildPreviewReportFromDb();
  const focus = selected ? report.players.find((p) => p.nickname.toLowerCase() === selected.toLowerCase()) : report.players[0];

  // "You" for the demo tag/share is the signed-in admin's own ops - never the
  // focused player. If the admin isn't one of the sample players, fall back to
  // a sample player so the share still resolves against the dummy report.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let realOps = "";
  if (user) {
    const { data: acc } = await supabase.from("accounts").select("ops_tag").eq("auth_user_id", user.id).maybeSingle();
    realOps = (acc?.ops_tag ?? "").trim();
  }
  const viewerOps = report.players.some((p) => p.nickname.toLowerCase() === realOps.toLowerCase()) ? realOps : "Kini";
  const viewerPlayer = report.players.find((p) => p.nickname.toLowerCase() === viewerOps.toLowerCase());
  const overlayData = viewerPlayer ? buildOverlayData(report, viewerPlayer) : undefined;

  return (
    <div>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Match Report Preview</h1>
        <p className="mt-2 text-sm text-text-muted">The real report with dummy stats and real badge art. Click any player to load their summary below.</p>
      </header>

      <PlayerNavProvider>
      <div className="flex flex-col gap-6">
        <MatchOverview game={report.game} matchDate={report.matchDate} />
        <PlayersTable players={report.players} matchId="PREVIEW" selectedPlayer={focus?.nickname ?? ""} />
        <PlayerCardArea>
          {focus && (
            <PlayerStatsCard
              player={focus}
              ranks={report.ranks}
              matchId="PREVIEW"
              canShare={focus.nickname.toLowerCase() === viewerOps.toLowerCase()}
            />
          )}
        </PlayerCardArea>
        <MatchImages
          photos={SAMPLE_PHOTOS}
          matchId="PREVIEW"
          viewerOps={viewerOps}
          isAdmin
          roster={report.players.map((p) => p.nickname)}
          overlayData={overlayData}
          demo
        />
      </div>
      </PlayerNavProvider>

      {focus && focus.nickname.toLowerCase() === viewerOps.toLowerCase() && (
        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-xl font-extrabold uppercase tracking-tight text-text sm:text-2xl">Shareable Story Images</h2>
          <p className="mt-2 text-sm text-text-muted">
            The four Instagram/Facebook story layouts (1080 × 1920) for your own player ({viewerOps}). Story images can only be
            created and shared for the signed-in user - this section is hidden while you view another player.
          </p>
          <StoryPreviewGallery ops={viewerOps} />
        </section>
      )}
    </div>
  );
}
