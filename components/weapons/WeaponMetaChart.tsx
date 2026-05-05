"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import type { WeaponUsageStats } from "@/lib/weapons/usage-stats";
import { ChartCard } from "@/components/portal/player-history/ChartCard";

/**
 * WeaponMetaChart
 * --------------------------------------------------------------------
 * Bubble chart positioning every gun in the (accuracy, K/D) plane,
 * with bubble size proportional to the gun's AVERAGE kills per match
 * across all recorded matches.
 *
 * Reads as a "weapon meta map":
 *   - Top right: high accuracy AND high K/D — strong, precise picks
 *   - Top left: low accuracy but high K/D — high-damage guns that
 *     don't need many hits
 *   - Bottom right: high accuracy, low K/D — players hit shots but
 *     still die a lot
 *   - Bottom left: low accuracy + low K/D — niche or troll picks
 *
 * Bubble size: the more kills per match a gun produces on average,
 * the bigger its bubble. We use the AVERAGE rather than the TOTAL so
 * a great-but-rarely-played gun shows up larger than a mediocre-but-
 * heavily-played one. Total kills would be a popularity metric; kills
 * per match is an effectiveness metric.
 *
 * --------------------------------------------------------------------
 * NEW IN PASS 22
 *
 * Mobile labels removed (reverting the pass 21 mobile-label
 * workaround). Pass 21 added them as a fix for unreliable mobile
 * tooltip taps — the bubbles were too small to hit, and even when
 * hit the tooltip flickered and died. Pass 21 also bumped
 * BUBBLE_MIN_R from 8 → 12 (24px diameter floor), which turns out
 * to be the actual fix: with the larger tap targets, mobile
 * tooltips now work well enough that labels become visual clutter
 * rather than a useful workaround.
 *
 * Desktop keeps labels — at >=1024px viewport width there's plenty
 * of room and at-a-glance gun identification is faster than
 * hovering each bubble. Mobile users tap a bubble and read the
 * tooltip.
 * --------------------------------------------------------------------
 */

type Props = {
  stats: WeaponUsageStats[];
  treeBranches: string[];
};

const FILTER_ALL = "all";

/**
 * Sample-size threshold. Guns with fewer matches are excluded
 * because their K/D and accuracy are statistically unstable. Set
 * to 1 while the data set is small — bump to 5 once each gun has
 * a comfortable sample.
 */
const MIN_MATCHES = 1;

/**
 * Bubble radius range (pixels). MIN_R bumped from 8 to 12 in pass 21
 * so the smallest bubbles are 24px diameter — still under iOS' 44px
 * touch target recommendation but a meaningful tap-accuracy
 * improvement. MAX_R also bumped to keep the visual hierarchy
 * (large bubbles dominate small ones) intact.
 *
 * The ZAxis range below uses these squared so bubble AREA (not
 * radius) scales linearly with kills/match — visually honest.
 */
const BUBBLE_MIN_R = 12;
const BUBBLE_MAX_R = 36;

/**
 * Viewport breakpoint above which we render data labels alongside
 * each bubble. 1024px = Tailwind's `lg` breakpoint.
 */
const LABEL_BREAKPOINT_PX = 1024;

type BubblePoint = {
  x: number;
  y: number;
  z: number;
  gunName: string;
  treeBranch: string;
  imageUrl: string;
  totalKills: number;
  avgKillsPerMatch: number;
  matchCount: number;
};

export function WeaponMetaChart({ stats, treeBranches }: Props) {
  const [selectedTree, setSelectedTree] = useState<string>(FILTER_ALL);
  const isDesktop = useIsDesktop();

  const data = useMemo<BubblePoint[]>(() => {
    return stats
      .filter((s) => s.matchCount >= MIN_MATCHES)
      .filter((s) => s.totalShots > 0)
      .filter((s) => {
        if (selectedTree === FILTER_ALL) return true;
        return s.treeBranch === selectedTree;
      })
      .map((s) => ({
        x: s.globalAccuracy * 100,
        y: s.globalKD,
        // Bubble size now tracks AVERAGE kills per match rather than
        // total kills. Total kills was misleading — it favoured
        // heavily-used guns regardless of effectiveness (a mediocre
        // gun played 100 times beat a great gun played 5 times).
        // Average kills/match is the more honest "how lethal is
        // this gun in a typical game" metric.
        z: s.avgKillsPerMatch,
        gunName: s.gunName,
        treeBranch: s.treeBranch,
        imageUrl: s.imageUrl,
        totalKills: s.totalKills,
        avgKillsPerMatch: s.avgKillsPerMatch,
        matchCount: s.matchCount,
      }));
  }, [stats, selectedTree]);

  if (data.length === 0) {
    return (
      <ChartCard
        title="Weapon Meta Map"
        subtitle="Where each gun sits in the accuracy vs K/D space, bubble size proportional to average kills per match."
      >
        <TreeFilter
          value={selectedTree}
          onChange={setSelectedTree}
          options={treeBranches}
        />
        <div className="flex h-[200px] items-center justify-center sm:h-[280px]">
          <p className="text-sm text-text-muted">
            {selectedTree === FILTER_ALL
              ? "Not enough match data yet to plot the meta."
              : "No recorded matches for this tree yet."}
          </p>
        </div>
      </ChartCard>
    );
  }

  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const xMin = Math.max(0, Math.floor(Math.min(...xs) - 5));
  const xMax = Math.min(100, Math.ceil(Math.max(...xs) + 5));
  const yMin = Math.max(0, Math.min(...ys) - 0.2);
  const yMax = Math.max(...ys) + 0.2;

  return (
    <ChartCard
      title="Weapon Meta Map"
      subtitle="Where each gun sits in the accuracy vs K/D space — bigger bubbles mean more kills per match on average."
    >
      <TreeFilter
        value={selectedTree}
        onChange={setSelectedTree}
        options={treeBranches}
      />
      <div className="h-[340px] w-full sm:h-[420px] lg:h-[480px]">
        <ResponsiveContainer width="100%" height="100%">
          {/* Top margin: 36 on desktop where labels render above the
              topmost bubbles (need clearance to avoid clipping
              against the card edge), 24 on mobile where labels
              aren't drawn. */}
          <ScatterChart
            margin={{
              top: isDesktop ? 36 : 24,
              right: 24,
              left: 0,
              bottom: 24,
            }}
          >
            <CartesianGrid stroke="#262626" />
            <XAxis
              type="number"
              dataKey="x"
              name="Accuracy"
              stroke="#737373"
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
              tickLine={false}
              axisLine={{ stroke: "#3a3a3a" }}
              domain={[xMin, xMax]}
              tickFormatter={(v: number) => `${Math.round(v)}%`}
              label={{
                value: "Accuracy",
                position: "insideBottom",
                offset: -10,
                fill: "#a3a3a3",
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="K/D"
              stroke="#737373"
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
              tickLine={false}
              axisLine={{ stroke: "#3a3a3a" }}
              width={36}
              domain={[yMin, yMax]}
              tickFormatter={(v: number) => v.toFixed(1)}
              label={{
                value: "K/D",
                angle: -90,
                position: "insideLeft",
                offset: 12,
                fill: "#a3a3a3",
                fontSize: 11,
              }}
            />
            <ZAxis
              type="number"
              dataKey="z"
              range={[BUBBLE_MIN_R * BUBBLE_MIN_R, BUBBLE_MAX_R * BUBBLE_MAX_R]}
              name="Kills/Match"
            />
            <Tooltip
              cursor={{ stroke: "#3a3a3a", strokeDasharray: "3 3" }}
              content={<BubbleTooltip />}
            />
            <Scatter
              data={data}
              fill="#ffde00"
              fillOpacity={0.7}
              stroke="#1a1a1a"
              strokeWidth={1}
            >
              {/* Bubble labels — desktop only. Pass 21 enabled mobile
                  labels as a workaround for unreliable tooltip taps,
                  but with the larger BUBBLE_MIN_R bumping tap targets
                  up to 24px diameter, mobile tap-for-tooltip now
                  works well enough to identify guns. Mobile users
                  get a cleaner chart without label overlap; desktop
                  users keep the at-a-glance label readability. */}
              {isDesktop && (
                <LabelList
                  dataKey="gunName"
                  position="top"
                  offset={8}
                  style={{
                    fill: "#d4d4d4",
                    fontSize: 10,
                    fontWeight: 500,
                    pointerEvents: "none",
                  }}
                />
              )}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/* ---------- Tree filter dropdown ---------- */

function TreeFilter({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (next: string) => void;
  options: string[];
}) {
  return (
    <label className="mb-4 flex flex-col items-center gap-1.5">
      <span className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-text-muted">
        Gun Tree
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block min-w-[200px] cursor-pointer rounded-sm border border-border bg-bg-elevated px-3 py-2 text-center text-sm font-semibold text-text transition-colors hover:border-border-strong focus-visible:border-accent focus-visible:outline-none"
      >
        <option value={FILTER_ALL}>All Trees</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ---------- Custom tooltip ---------- */

function BubbleTooltip({
  active,
  payload,
}: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload as BubblePoint;
  if (!p) return null;

  return (
    <div className="rounded-sm border border-border-strong bg-bg-overlay px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-bold text-text">{p.gunName}</p>
      <p className="font-mono tabular-nums text-text-muted">
        Accuracy: <span className="text-accent">{Math.round(p.x)}%</span>
      </p>
      <p className="font-mono tabular-nums text-text-muted">
        K/D: <span className="text-accent">{p.y.toFixed(2)}</span>
      </p>
      {/* Kills/Match is the bubble-size driver — show it prominently
          here. Total kills follows as context (so players still know
          the absolute scale). */}
      <p className="font-mono tabular-nums text-text-muted">
        Kills/Match:{" "}
        <span className="text-accent">{p.avgKillsPerMatch.toFixed(2)}</span>
      </p>
      <p className="font-mono tabular-nums text-text-muted">
        Total Kills:{" "}
        <span className="text-accent">
          {p.totalKills.toLocaleString("en-US")}
        </span>
      </p>
      <p className="mt-1 text-[0.7rem] uppercase tracking-[0.1em] text-text-subtle">
        {p.matchCount} matches
      </p>
    </div>
  );
}

/* ---------- Desktop detection hook ---------- */

/**
 * Returns true on desktop (viewport ≥ LABEL_BREAKPOINT_PX), false
 * otherwise. Listens to window resize so the value updates if the
 * user rotates a tablet or resizes their browser.
 *
 * SSR returns false unconditionally so the server-rendered HTML is
 * the mobile variant; the client-side render upgrades after
 * hydration when we know the actual viewport. This avoids a flash
 * of desktop labels on mobile devices that briefly hydrate before
 * the matchMedia fires.
 */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(min-width: ${LABEL_BREAKPOINT_PX}px)`);
    setIsDesktop(mq.matches);

    function onChange(e: MediaQueryListEvent) {
      setIsDesktop(e.matches);
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}
