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
  LabelList,
} from "recharts";
import type { PlayerMatch } from "@/lib/player-history/engine";
import { ChartCard } from "./ChartCard";
import { DarkTooltip, NoDataPanel } from "./EloProgressionChart";

/**
 * ScoreVsAvgChart
 * --------------------------------------------------------------------
 * Per-match: yellow bar (player's score) alongside grey bar (average
 * score across all players in that match). A red line on the
 * secondary axis tracks the player's "match rating" — the ratio of
 * player score to avg match score.
 *
 * Mirrors the Looker dashboard chart of the same name.
 *
 * Reading it: yellow bar above grey bar means the player outscored
 * the match average. Match rating > 1.0 means above average; < 1.0
 * means below.
 */

type Props = {
  matches: PlayerMatch[];
};

export function ScoreVsAvgChart({ matches }: Props) {
  const data = matches.map((m) => ({
    matchId: m.matchId,
    score: m.score,
    avgScore: m.averageMatchScore,
    matchRating: m.matchRating,
  }));

  if (data.length === 0) {
    return (
      <ChartCard title="Player Score vs Avg Match Score">
        <NoDataPanel message="No match data available yet." />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Player Score vs Avg Match Score"
      subtitle="Compare your scores vs the average score of all players, and track your performance trends using the Player Match Rating (Ratio of your score vs the average match score)."
    >
      <div className="h-[300px] w-full sm:h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 28, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#262626" vertical={false} />
            <XAxis
              dataKey="matchId"
              stroke="#737373"
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
              tickLine={false}
              axisLine={{ stroke: "#3a3a3a" }}
            />
            {/* Primary Y axis: score scale (0..max player or avg score) */}
            <YAxis
              yAxisId="left"
              stroke="#737373"
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
              tickLine={false}
              axisLine={{ stroke: "#3a3a3a" }}
              width={48}
              tickFormatter={(v: number) =>
                v >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${v}`
              }
            />
            {/* Secondary Y axis: match rating (0..max rating, typically 0..3.5ish) */}
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#737373"
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
              tickLine={false}
              axisLine={{ stroke: "#3a3a3a" }}
              width={36}
            />
            <Tooltip content={<DarkTooltip />} cursor={{ fill: "#26262640" }} />
            <Legend
              wrapperStyle={{ fontSize: 12, color: "#a3a3a3" }}
              iconType="rect"
            />
            <Bar yAxisId="left" dataKey="score" name="Player Score" fill="#ffde00" radius={[2, 2, 0, 0]} />
            <Bar yAxisId="left" dataKey="avgScore" name="Avg Match Score" fill="#525252" radius={[2, 2, 0, 0]} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="matchRating"
              name="Player Match Rating"
              stroke="#ef4444"
              strokeWidth={2.5}
              dot={{ fill: "#ef4444", r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#fca5a5" }}
            >
              <LabelList
                dataKey="matchRating"
                position="top"
                fill="#fca5a5"
                fontSize={11}
                offset={8}
                formatter={(v: number) => v.toFixed(2)}
              />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
