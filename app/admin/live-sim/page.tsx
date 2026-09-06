/**
 * app/admin/live-sim/page.tsx
 * --------------------------------------------------------------------
 * Simulation of the live per-player phone view — replays a real match by its
 * event timestamps to preview what players would see live on their phones.
 */
import { LiveSim, type MatchData } from "@/components/admin/LiveSim";
import matchJson from "@/lib/live-sim/match.json";

const match = matchJson as unknown as MatchData;

export const metadata = { title: "Live view simulation" };

export default function LiveSimPage() {
  return (
    <div>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Live Player View — Simulation</h1>
        <p className="mt-2 text-sm text-text-muted">
          Replays <span className="text-text">{match.label}</span> ({match.rounds.length} rounds) from real timestamps to preview the live per-player phone view.
          Each round ends when a team burns 2 bases, then the next auto-starts. Press Play, pick a player, or jump between rounds.
        </p>
      </header>
      <LiveSim match={match} />
    </div>
  );
}
