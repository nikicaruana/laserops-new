"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import type { ArmoryEntry } from "@/lib/weapons/armory";
import { ChartCard } from "@/components/portal/player-history/ChartCard";

/**
 * PlayerKillDistributionChart
 * --------------------------------------------------------------------
 * Pie chart of the player's total kills, split by gun. Top guns each
 * get their own slice; the long tail is bucketed into a single "Other"
 * slice so the chart stays legible even when a player has used 15+
 * different weapons.
 *
 * First use of recharts PieChart in the codebase. Colour palette
 * follows the brand (yellow accent at the top, then warm/cool sequence
 * for visual differentiation), with a neutral grey for "Other".
 */

const TOP_N = 7;

/**
 * Slice colours, biggest → smallest. Yellow at top to anchor the brand,
 * then a sequence chosen for high contrast against the dark card body.
 * "Other" always uses the trailing neutral grey.
 */
const SLICE_COLOURS = [
  "#ffde00", // accent yellow — biggest gun
  "#facc15", // amber-400
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#a855f7", // violet-500
];
const OTHER_COLOUR = "#525252"; // neutral-600

type Slice = {
  name: string;
  value: number;
  colour: string;
};

type Props = {
  entries: ArmoryEntry[];
};

export function PlayerKillDistributionChart({ entries }: Props) {
  const { slices, total } = useMemo(() => {
    const used = entries
      .filter((e) => e.gunIsUnlocked && e.killsTotal > 0)
      .sort((a, b) => b.killsTotal - a.killsTotal);

    const head = used.slice(0, TOP_N);
    const tail = used.slice(TOP_N);
    const tailSum = tail.reduce((s, e) => s + e.killsTotal, 0);

    const out: Slice[] = head.map((e, i) => ({
      name: e.gunDisplayTitle || e.gunName,
      value: e.killsTotal,
      colour: SLICE_COLOURS[i] ?? OTHER_COLOUR,
    }));

    if (tailSum > 0) {
      out.push({
        name: `Other (${tail.length})`,
        value: tailSum,
        colour: OTHER_COLOUR,
      });
    }

    const total = out.reduce((s, e) => s + e.value, 0);
    return { slices: out, total };
  }, [entries]);

  if (slices.length === 0 || total === 0) {
    return (
      <ChartCard
        title="Kill Distribution"
        subtitle="How your kills break down across the guns you've used."
      >
        <div className="flex h-[200px] items-center justify-center sm:h-[280px]">
          <p className="text-sm text-text-muted">
            No kills recorded yet — play a match to populate this chart.
          </p>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Kill Distribution"
      subtitle="How your kills break down across the guns you've used. The top seven get their own slices; the rest collapse into 'Other'."
    >
      <div className="h-[340px] w-full sm:h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius="80%"
              innerRadius="45%"
              paddingAngle={1}
              stroke="#1a1a1a"
              strokeWidth={1}
            >
              {slices.map((s) => (
                <Cell key={s.name} fill={s.colour} />
              ))}
            </Pie>
            <Tooltip content={<SliceTooltip total={total} />} />
            <Legend
              verticalAlign="bottom"
              align="center"
              iconType="square"
              wrapperStyle={{ fontSize: 11, color: "#d4d4d4" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function SliceTooltip({
  active,
  payload,
  total,
}: TooltipProps<number, string> & { total: number }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0];
  const value = typeof p.value === "number" ? p.value : 0;
  const pct = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="rounded-sm border border-border-strong bg-bg-overlay px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-bold text-text">{String(p.name)}</p>
      <p className="font-mono tabular-nums text-text-muted">
        Kills:{" "}
        <span className="text-accent">{value.toLocaleString("en-US")}</span>
      </p>
      <p className="font-mono tabular-nums text-text-muted">
        Share: <span className="text-accent">{pct.toFixed(1)}%</span>
      </p>
    </div>
  );
}
