import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { getReport, listReports } from "@/lib/match-report-v2/reports";
import { MatchPicker } from "@/components/match-report-v2/MatchPicker";
import { MatchOverview } from "@/components/match-report-v2/MatchOverview";
import { PlayersTable } from "@/components/match-report-v2/PlayersTable";
import { PlayerStatsCard } from "@/components/match-report-v2/PlayerStatsCard";
import { PlayerNavProvider, PlayerCardArea } from "@/components/match-report-v2/PlayerNav";

export const metadata: Metadata = {
  title: "Match Report v2 (Beta) · LaserOps",
  description: "Preview of the new match report format and scoring, generated from game data.",
};

export default async function MatchReportV2Page({ searchParams }: { searchParams: Promise<{ match?: string; player?: string }> }) {
  const { match, player } = await searchParams;
  const report = getReport(match);
  const matches = listReports();

  if (!report) {
    return (
      <Container size="wide" as="main" className="py-8 sm:py-12">
        <p className="text-text-muted">No reportable matches yet.</p>
      </Container>
    );
  }

  const selected = (player ?? "").trim();
  const focus = selected
    ? report.players.find((p) => p.nickname.toLowerCase() === selected.toLowerCase()) ?? report.players[0]
    : report.players[0];

  return (
    <Container size="wide" as="main" className="py-8 sm:py-12">
      <header className="mb-6 flex flex-wrap items-center gap-3 border-b border-border pb-5">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Match Report</h1>
        <span className="rounded-full border border-accent px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-accent">v2 · Beta</span>
        <p className="w-full text-sm text-text-muted">A preview of the new match-report format and scoring, generated from the game data.</p>
      </header>

      {/* Work-in-progress disclaimer */}
      <div className="mb-5 rounded-md border border-accent bg-bg-elevated px-4 py-3 text-sm text-text">
        <span className="font-semibold uppercase tracking-[0.1em] text-accent">Work in progress · </span>
        This is a preview to show the new report format and scoring. Nothing here is final — the scoring model, values and layout are all still being tuned and may change.
      </div>

      {/* Scoring notes */}
      <div className="mb-6 rounded-md border border-border bg-bg-elevated px-4 py-3 text-sm text-text-muted">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-text-subtle">How it&apos;s currently scored</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><span className="text-text">Base capture:</span> 75 points — only if the base is held for at least 5 seconds (shorter captures don&apos;t count).</li>
          <li><span className="text-text">Recapture:</span> 50 points — retaking the same base within 20 seconds.</li>
          <li><span className="text-text">Hold:</span> 2 points per second a base is held.</li>
          <li><span className="text-text">Kills:</span> score also factors in kills, damage, accuracy and K/D; spawn-trap kills are voided. Streaks add points too.</li>
          <li><span className="text-text">XP (estimated):</span> score + 750 per round won + 500 for the match win + accolade XP. Accolades give XP only, not score.</li>
        </ul>
      </div>

      <div className="mb-6">
        <MatchPicker matches={matches} current={report.game.matchId} />
      </div>

      <PlayerNavProvider>
        <div className="flex flex-col gap-6">
          <MatchOverview game={report.game} matchDate={report.matchDate} />
          <PlayersTable players={report.players} matchId={report.game.matchId} selectedPlayer={focus?.nickname ?? ""} />
          <PlayerCardArea>
            {focus && (
              <PlayerStatsCard player={focus} ranks={report.ranks} matchId={report.game.matchId} canShare={false} />
            )}
          </PlayerCardArea>
        </div>
      </PlayerNavProvider>
    </Container>
  );
}
