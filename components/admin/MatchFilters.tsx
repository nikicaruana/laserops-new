"use client";

/**
 * components/admin/MatchFilters.tsx
 * --------------------------------------------------------------------
 * Match Manager filters: multi-select Status and Type, each with its own
 * "Select all" / "Select none" shortcut, plus the date-range filter.
 *
 * State lives in the URL (so the server component can filter server-side):
 *   ?status=tentative,live   ?type=private,double_xp
 * Each param is a comma-separated list of keys. The literal value "none" means
 * an empty selection, and an ABSENT param means the default selection
 * (DEFAULT_STATUS / DEFAULT_TYPE) — so a fresh page load shows the active games
 * of every type without needing any params in the URL.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { MatchDateFilter } from "@/components/admin/MatchDateFilter";
import {
  STATUS_TABS,
  TYPE_TABS,
  STATUS_KEYS,
  TYPE_KEYS,
  encodeSelection,
} from "@/lib/admin/match-filters";

function FilterGroup({
  title,
  tabs,
  selected,
  allKeys,
  paramKey,
  size = "sm",
}: {
  title: string;
  tabs: { key: string; label: string }[];
  selected: string[];
  allKeys: string[];
  paramKey: "status" | "type";
  size?: "sm" | "xs";
}) {
  const router = useRouter();
  const params = useSearchParams();
  const sel = new Set(selected);
  const tabText = size === "xs" ? "text-[0.7rem]" : "text-xs";

  function apply(values: string[]) {
    const next = new URLSearchParams(params.toString());
    next.set(paramKey, encodeSelection(values));
    router.push(`/admin/matches?${next.toString()}`);
  }
  function toggle(key: string) {
    apply(sel.has(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  }

  const shortcut =
    "border border-border-strong px-2 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-text-muted hover:border-accent hover:text-accent";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-text-subtle">{title}</span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => apply(allKeys)} className={shortcut}>
          Select all
        </button>
        <button type="button" onClick={() => apply([])} className={shortcut}>
          Select none
        </button>
      </div>
      <span aria-hidden className="h-5 w-px bg-border-strong" />
      {tabs.map((t) => {
        const on = sel.has(t.key);
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => toggle(t.key)}
            aria-pressed={on}
            className={`border px-3 py-1.5 ${tabText} font-semibold uppercase tracking-[0.1em] ${
              on
                ? "border-accent bg-bg-elevated text-accent"
                : "border-border-strong text-text-muted hover:border-accent hover:text-accent"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function MatchFilters({ selStatus, selType }: { selStatus: string[]; selType: string[] }) {
  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterGroup title="Status" tabs={STATUS_TABS} selected={selStatus} allKeys={STATUS_KEYS} paramKey="status" />
        <MatchDateFilter />
      </div>
      <FilterGroup title="Type" tabs={TYPE_TABS} selected={selType} allKeys={TYPE_KEYS} paramKey="type" size="xs" />
    </div>
  );
}
