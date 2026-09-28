"use client";

/**
 * components/admin/MatchDateFilter.tsx
 * --------------------------------------------------------------------
 * From/to date range filter for the Match Manager, sitting alongside the status
 * tabs. Writes `from`/`to` to the URL (preserving the active status) so the
 * server filters by each match's date. Native date inputs, dark-themed.
 */
import { useRouter, useSearchParams } from "next/navigation";

const input =
  "h-8 rounded-none border border-border-strong bg-bg-elevated px-2 text-xs text-text [color-scheme:dark] focus:border-accent focus:outline-none";

export function MatchDateFilter() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  function set(key: "from" | "to", value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.push(qs ? `/admin/matches?${qs}` : "/admin/matches");
  }

  function clear() {
    const next = new URLSearchParams(params.toString());
    next.delete("from");
    next.delete("to");
    const qs = next.toString();
    router.push(qs ? `/admin/matches?${qs}` : "/admin/matches");
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-text-subtle">Date</span>
      <input type="date" aria-label="From date" value={from} max={to || undefined} className={input} onChange={(e) => set("from", e.target.value)} />
      <span className="text-text-subtle">to</span>
      <input type="date" aria-label="To date" value={to} min={from || undefined} className={input} onChange={(e) => set("to", e.target.value)} />
      {(from || to) && (
        <button type="button" onClick={clear} className="px-1 text-xs font-semibold uppercase tracking-[0.1em] text-text-subtle hover:text-accent">
          Clear
        </button>
      )}
    </div>
  );
}
