/**
 * app/admin/live-sim/page.tsx
 * --------------------------------------------------------------------
 * Simulation of the live per-player phone view — replays a real match by its
 * event timestamps to prototype what players would see live on their phones.
 */
import { LiveSim, type SimData } from "@/components/admin/LiveSim";
import roundJson from "@/lib/live-sim/round.json";

const round = roundJson as unknown as SimData;

export const metadata = { title: "Live view simulation" };

export default function LiveSimPage() {
  return (
    <div>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Live Player View — Simulation</h1>
        <p className="mt-2 text-sm text-text-muted">
          Replays <span className="text-text">{round.label}</span> from its real timestamps to preview the live per-player phone view.
          Press Play (try 60×) and pick a player. In production this would be driven live by the round file as the game is played.
        </p>
      </header>
      <LiveSim data={round} />
    </div>
  );
}
