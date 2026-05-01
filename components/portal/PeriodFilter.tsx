"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/cn";
import type { FilterOption } from "@/lib/leaderboards/period-shared";

/**
 * PeriodFilter
 * --------------------------------------------------------------------
 * Two-dropdown filter row for Year and Month, used by leaderboards that
 * read from the period-stats sheet.
 *
 * State:
 *   - Lives in URL search params (`?year=2026&month=4`) so the selection
 *     survives refresh, can be shared via link, and the back button works.
 *   - Each leaderboard reads the same params, so a Year/Month chosen on the
 *     "Match/Round Wins" table would also be the default on a "Total Points"
 *     table on the same page. Probably what users expect — they're filtering
 *     "the period I'm looking at", not per-table.
 *   - Empty / "all" maps to the absence of the param in the URL. Choosing
 *     "All Years" clears `?year=`.
 *
 * UI:
 *   - Native <select> for accessibility and mobile native pickers — iOS
 *     shows the system wheel picker which is what users expect.
 *   - Styled to fit the dark/yellow brand: appearance-none, custom chevron
 *     SVG, dark-overlay background.
 */

type PeriodFilterProps = {
  years: FilterOption<number>[];
  months: FilterOption<number>[];
  /**
   * Param name used to identify this filter's table in the URL. If multiple
   * filterable tables ever appear on one page and we want them to filter
   * independently, pass a different `paramScope` per table. Default is
   * shared ("year" and "month"), which is the right behaviour today.
   */
  paramScope?: { year: string; month: string };
};

const DEFAULT_SCOPE = { year: "year", month: "month" };

export function PeriodFilter({ years, months, paramScope = DEFAULT_SCOPE }: PeriodFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Read current values from URL. Empty string = "All".
  const currentYear = searchParams.get(paramScope.year) ?? "";
  const currentMonth = searchParams.get(paramScope.month) ?? "";

  function updateParam(name: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "") {
      next.delete(name);
    } else {
      next.set(name, value);
    }
    const queryString = next.toString();
    const url = queryString ? `${pathname}?${queryString}` : pathname;
    // useTransition keeps the UI responsive — the URL update is treated as
    // a non-urgent state change so React can interrupt if the user clicks
    // again before the previous update fully renders.
    startTransition(() => {
      // scroll: false because we want the page's scroll position preserved
      // when switching filters mid-page on mobile.
      router.replace(url, { scroll: false });
    });
  }

  return (
    <div
      className={cn(
        "mb-3 flex flex-wrap items-center justify-center gap-2 sm:gap-3",
        // Subtle visual cue while the URL update is in flight
        isPending && "opacity-70",
      )}
    >
      <FilterDropdown
        label="Year"
        value={currentYear}
        onChange={(v) => updateParam(paramScope.year, v)}
        options={years}
        allLabel="All Years"
      />
      <FilterDropdown
        label="Month"
        value={currentMonth}
        onChange={(v) => updateParam(paramScope.month, v)}
        options={months}
        allLabel="All Months"
      />
    </div>
  );
}

/* ---------- One styled dropdown ---------- */

type FilterDropdownProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption<number>[];
  /** Label for the "no filter" option. */
  allLabel: string;
};

function FilterDropdown({ label, value, onChange, options, allLabel }: FilterDropdownProps) {
  return (
    <label className="relative inline-flex items-center">
      {/* Visually hidden label for screen readers. The native <select>
          shows the current value as its display anyway. */}
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          // Reset native chrome so we can style it consistently
          "appearance-none cursor-pointer",
          // Sizing & spacing — extra right padding for the custom chevron
          "py-1.5 pl-3 pr-8 sm:py-2 sm:pl-4 sm:pr-9",
          // Brand surface
          "border border-border-strong bg-bg-overlay text-text",
          "rounded-sm",
          // Typography matches the portal's tab/header rhythm
          "text-[0.7rem] font-semibold uppercase tracking-[0.14em] sm:text-xs",
          // Hover & focus states
          "transition-colors hover:border-accent",
          "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
        )}
      >
        <option value="">{allLabel}</option>
        {options.map((opt) => (
          <option key={opt.value} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </select>
      {/* Custom yellow chevron — the native one is hidden via appearance-none.
          Pointer-events-none so clicks pass through to the select. */}
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className="pointer-events-none absolute right-3 h-3 w-3 text-accent"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M2 4l4 4 4-4" strokeLinecap="square" strokeLinejoin="miter" />
      </svg>
    </label>
  );
}
