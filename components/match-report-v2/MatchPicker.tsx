"use client";

import { useRouter, usePathname } from "next/navigation";

/** Match dropdown for the beta report — navigates to ?match=<id> (server reloads). */
export function MatchPicker({ matches, current }: { matches: { matchId: string; label: string }[]; current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  if (matches.length <= 1) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-subtle">Match</span>
        <span className="rounded-md border border-border-strong bg-bg-elevated px-3 py-1.5 text-sm text-text">
          {matches[0]?.label ?? current}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="mrv2-match" className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-subtle">Match</label>
      <select
        id="mrv2-match"
        value={current}
        onChange={(e) => router.push(`${pathname}?match=${encodeURIComponent(e.target.value)}`, { scroll: false })}
        className="rounded-md border border-border-strong bg-bg-elevated px-3 py-1.5 text-sm text-text outline-none focus:border-accent"
      >
        {matches.map((m) => <option key={m.matchId} value={m.matchId}>{m.label}</option>)}
      </select>
    </div>
  );
}
