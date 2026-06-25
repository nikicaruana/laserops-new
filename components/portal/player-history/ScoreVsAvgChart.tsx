"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { PlayerMatch } from "@/lib/player-history/engine";
import { ChartCard } from "./ChartCard";
import { DarkTooltip, NoDataPanel } from "./EloProgressionChart";
import { useInView } from "@/lib/hooks/useInView";

/**
 * ScoreVsAvgChart
 * --------------------------------------------------------------------
 * Per-match: yellow bar (player's score) alongside grey bar (average
 * score across all players in that match). A red line on the
 * secondary axis tracks the player's "match rating" — the ratio of
 * player score to avg match score.
 *
 * --------------------------------------------------------------------
 * CHANGE in this pass: tighter right margin (4 vs 12) to claw back
 * mobile horizontal space, in concert with the ChartCard's removed
 * mobile inner padding.
 * --------------------------------------------------------------------
 */

type Props = {
  matches: PlayerMatch[];
};

export function ScoreVsAvgChart({ matches }: Props) {
  const { ref, inView } = useInView(0.3);

  const data = matches.map((m) => ({
    matchId: m.matchId,
    score: m.score,
    avgScore: m.averageMatchScore,
    matchRating: m.matchRating,
  }));

  if (data.length === 0) {
    return (
      <ChartCard title="Score vs Avg Match Score">
        <NoDataPanel message="No match data available yet." />
      </ChartCard>
    );
  }

  const allBarValues = data.flatMap((d) => [d.score, d.avgScore]);
  const leftMax = niceCeil(Math.max(...allBarValues) * 1.1);

  const ratings = data.map((d) => d.matchRating);
  const [rMin, rMax] = fittedDomain(ratings, { padFraction: 0.15, minPad: 0.1 });

  return (
    <ChartCard
      title="Score vs Avg Match Score"
      subtitle="Your score per match against the average score of everyone in that match. The red line is your match rating (your score ÷ the match average)."
    >
      <div ref={ref} className="h-[300px] w-full sm:h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart key={String(inView)} data={data} margin={{ top: 20, right: 4, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#262626" vertical={false} />
            <XAxis
              dataKey="matchId"
              stroke="#737373"
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
              tickLine={false}
              axisLine={{ stroke: "#3a3a3a" }}
            />
            <YAxis
              yAxisId="left"
              stroke="#737373"
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
              tickLine={false}
              axisLine={{ stroke: "#3a3a3a" }}
              width={40}
              domain={[0, leftMax]}
              allowDecimals={false}
              tickFormatter={(v: number) =>
                v >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${v}`
              }
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#737373"
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
              tickLine={false}
              axisLine={{ stroke: "#3a3a3a" }}
              width={32}
              domain={[rMin, rMax]}
              tickFormatter={(v: number) => v.toFixed(1)}
            />
            <Tooltip content={<DarkTooltip />} cursor={{ fill: "#26262640" }} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#a3a3a3" }} iconType="rect" />
            <Bar yAxisId="left" dataKey="score" name="Player Score" fill="#ffde00" radius={[2, 2, 0, 0]} isAnimationActive={inView} />
            <Bar yAxisId="left" dataKey="avgScore" name="Avg Match Score" fill="#525252" radius={[2, 2, 0, 0]} isAnimationActive={inView} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="matchRating"
              name="Player Match Rating"
              stroke="#ef4444"
              strokeWidth={2.5}
              dot={{ fill: "#ef4444", r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#fca5a5" }}
              isAnimationActive={inView}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/* ---------- Local axis helpers ---------- */

function fittedDomain(
  values: number[],
  opts: { padFraction: number; minPad: number },
): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 0);
  const pad = Math.max(spread * opts.padFraction, opts.minPad);
  return [min - pad, max + pad];
}

function niceCeil(value: number): number {
  if (value <= 0) return 0;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const step = magnitude / 2;
  return Math.ceil(value / step) * step;
}
