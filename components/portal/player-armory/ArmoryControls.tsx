"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import type { ArmoryBranch, ArmoryEntry } from "@/lib/weapons/armory";
import { ArmoryCard } from "./ArmoryCard";

/**
 * ArmoryControls
 * --------------------------------------------------------------------
 * Client wrapper for the armory card list. Owns three pieces of
 * filter/sort state and renders the controls bar above the cards:
 *
 *   1. Show Locked toggle — hides locked guns when off
 *   2. Tree filter — checkbox dropdown, all branches selected by default
 *   3. Sort by — select, defaults to "Gun Tree" (branch + sortOrder)
 *
 * Always renders a flat list. Gun Tree sort preserves the original
 * branch + sortOrder ordering; other sorts order by the chosen stat
 * descending.
 *
 * Desktop layout: single-column (grid-cols-1), each ArmoryCard switches
 * to a horizontal orientation (image left, stats right) via lg: variants
 * inside ArmoryCard itself.
 */

type SortKey = "tree" | "kills" | "kd" | "accuracy" | "points" | "wins";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "tree", label: "Gun Tree" },
  { value: "kills", label: "Kills" },
  { value: "kd", label: "K/D Ratio" },
  { value: "accuracy", label: "Accuracy" },
  { value: "points", label: "Points" },
  { value: "wins", label: "Match Wins" },
];

type Props = { branches: ArmoryBranch[] };

export function ArmoryControls({ branches }: Props) {
  const branchNames = useMemo(() => branches.map((b) => b.branch), [branches]);

  const [showLocked, setShowLocked] = useState(true);
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(
    () => new Set(branchNames),
  );
  const [sortBy, setSortBy] = useState<SortKey>("tree");
  const [treeOpen, setTreeOpen] = useState(false);

  const allSelected = selectedBranches.size === branchNames.length;

  function toggleBranch(branch: string) {
    setSelectedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(branch)) {
        if (next.size === 1) return prev; // must keep at least one
        next.delete(branch);
      } else {
        next.add(branch);
      }
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedBranches(new Set([branchNames[0] ?? ""]));
    } else {
      setSelectedBranches(new Set(branchNames));
    }
  }

  // Apply show-locked + branch filters.
  const filteredBranches = useMemo(
    () =>
      branches
        .filter((b) => selectedBranches.has(b.branch))
        .map((b) => ({
          ...b,
          entries: showLocked
            ? b.entries
            : b.entries.filter((e) => e.gunIsUnlocked),
        }))
        .filter((b) => b.entries.length > 0),
    [branches, selectedBranches, showLocked],
  );

  const allEntries = useMemo(
    () => filteredBranches.flatMap((b) => b.entries),
    [filteredBranches],
  );

  // Sorted flat list for non-tree sorts.
  const sortedEntries = useMemo((): ArmoryEntry[] => {
    if (sortBy === "tree") return allEntries;
    return [...allEntries].sort((a, b) => {
      switch (sortBy) {
        case "kills":    return b.killsTotal   - a.killsTotal;
        case "kd":       return b.kdRatio      - a.kdRatio;
        case "accuracy": return b.avgAccuracy  - a.avgAccuracy;
        case "points":   return b.scoreTotal   - a.scoreTotal;
        case "wins":     return b.winsUsingGun - a.winsUsingGun;
        default:         return 0;
      }
    });
  }, [allEntries, sortBy]);

  const treeLabel = allSelected
    ? "All Trees"
    : branchNames.filter((b) => selectedBranches.has(b)).join(", ");

  return (
    <div className="mt-6 flex flex-col gap-4 sm:gap-6">
      {/* ── Controls bar ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">

        {/* Show Locked toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={showLocked}
          onClick={() => setShowLocked((v) => !v)}
          className="flex items-center gap-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          <span
            aria-hidden
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors duration-200",
              showLocked
                ? "border-accent bg-accent"
                : "border-border bg-bg-elevated",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-bg transition-transform duration-200",
                showLocked ? "translate-x-[1.125rem]" : "translate-x-[0.125rem]",
              )}
            />
          </span>
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted">
            Show Locked
          </span>
        </button>

        {/* Tree filter — only shown when there are multiple branches */}
        {branchNames.length > 1 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setTreeOpen((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.12em] transition-colors",
                treeOpen
                  ? "border-accent text-accent"
                  : "border-border text-text-muted hover:border-border-strong hover:text-text",
              )}
            >
              {treeLabel}
              <svg
                aria-hidden
                viewBox="0 0 10 6"
                className={cn(
                  "h-2.5 w-2.5 transition-transform duration-200",
                  treeOpen && "rotate-180",
                )}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="square"
              >
                <path d="M1 1l4 4 4-4" />
              </svg>
            </button>

            {treeOpen && (
              <>
                {/* Click-outside backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setTreeOpen(false)}
                />
                {/* Panel */}
                <div className="absolute left-0 top-full z-20 mt-1 min-w-[140px] rounded-sm border border-border bg-bg-elevated py-1 shadow-lg">
                  {/* All / none */}
                  <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-bg-overlay">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="h-3 w-3 accent-[#ffde00]"
                    />
                    <span className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-text">
                      All
                    </span>
                  </label>
                  <div className="my-0.5 border-t border-border" />
                  {branchNames.map((branch) => (
                    <label
                      key={branch}
                      className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-bg-overlay"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBranches.has(branch)}
                        onChange={() => toggleBranch(branch)}
                        className="h-3 w-3 accent-[#ffde00]"
                      />
                      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted">
                        {branch}
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Sort by */}
        <div className="flex items-center gap-2">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-subtle">
            Sort
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="rounded-sm border border-border bg-bg-elevated px-2 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-text-muted focus:border-accent focus:outline-none"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Card list — always a flat list ───────────────────── */}
      <div className="flex flex-col gap-3">
        {sortedEntries.map((entry) => (
          <ArmoryCard
            key={`${entry.gunName}-${entry.playerNickname}`}
            entry={entry}
          />
        ))}
        {sortedEntries.length === 0 && <EmptyFilter />}
      </div>
    </div>
  );
}

function EmptyFilter() {
  return (
    <div className="rounded-sm border border-dashed border-border bg-bg-elevated px-6 py-10 text-center">
      <p className="text-sm text-text-muted">
        No guns match the current filters.
      </p>
    </div>
  );
}
