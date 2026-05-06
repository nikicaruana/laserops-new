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
import type { ArmoryEntry } from "@/lib/weapons/armory";
import { ChartCard } from "@/components/portal/player-history/ChartCard";

/**
 * PlayerWeaponMetaChart
 * --------------------------------------------------------------------
 * Per-player version of the global /weapons WeaponMetaChart. Each
 * bubble is one gun the viewed player has used, plotted against:
 *   - X: their accuracy with that gun
 *   - Y: their K/D with that gun
 *   - Bubble size: average kills per match with that gun
 *
 * Reads as "where do my favourite guns sit on the lethality map." Same
 * visual recipe as the public chart — same axis colours, same tooltip
 * style, same Z-domain — for consistency across the site.
 *
 * No tree-branch filter. The collapsibles below already partition by
 * tree branch; the chart is the cross-tree summary.
 */

const BUBBLE_MIN_R = 12;
const BUBBLE_MAX_R = 36;
const LABEL_BREAKPOINT_PX = 1024;
const MIN_MATCHES = 1;

type BubblePoint = {
  x: number;
  y: number;
  z: number;
  gunName: string;
  treeBranch: string;
  totalKills: number;
  avgKillsPerMatch: number;
  matchCount: number;
};

type Props = {
  entries: ArmoryEntry[];
};

export function PlayerWeaponMetaChart({ entries }: Props) {
  const isDesktop = useIsDesktop();

  const data = useMemo<BubblePoint[]>(() => {
    return entries
      .filter((e) => e.gunIsUnlocked && e.hasUsedGun)
      .filter((e) => e.matchesUsed >= MIN_MATCHES)
      .filter((e) => e.shotsTotal > 0)
      .map((e) => ({
        // The Player_Armory sheet stores avgAccuracy as a 0–1 fraction
        // (matching the dialog's heuristic). Multiply by 100 for the
        // percent axis. Defensive: treat values >1.5 as already-percent.
        x: e.avgAccuracy <= 1.5 ? e.avgAccuracy * 100 : e.avgAccuracy,
        y: e.kdRatio,
        z: e.avgKills,
        gunName: e.gunName,
        treeBranch: e.treeBranch,
        totalKills: e.killsTotal,
        avgKillsPerMatch: e.avgKills,
        matchCount: e.matchesUsed,
      }));
  }, [entries]);

  if (data.length === 0) {
    return (
      <ChartCard
        title="Your Weapon Meta"
        subtitle="Where each of your guns sits in the accuracy vs K/D space, bubble size proportional to your average kills per match."
      >
        <div className="flex h-[200px] items-center justify-center sm:h-[280px]">
          <p className="text-sm text-text-muted">
            No used-weapon data yet — play a match to populate this chart.
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
      title="Your Weapon Meta"
      subtitle="Where each of your guns sits in the accuracy vs K/D space — bigger bubbles mean more kills per match on average."
    >
      <div className="h-[340px] w-full sm:h-[420px] lg:h-[480px]">
        <ResponsiveContainer width="100%" height="100%">
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

function BubbleTooltip({ active, payload }: TooltipProps<number, string>) {
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
