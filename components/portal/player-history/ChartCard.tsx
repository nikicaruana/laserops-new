import type { ReactNode } from "react";

/**
 * ChartCard
 * --------------------------------------------------------------------
 * Shared wrapper for the History page charts. Yellow header banner
 * with the chart title, optional subtitle below, then the chart body
 * on a dark background.
 *
 * Mirrors the Looker dashboard's chart card visual: rounded yellow
 * pill at the top with the chart name in big black text, then the
 * chart sitting on dark below.
 *
 * Usage:
 *   <ChartCard title="ELO Rating Progression" subtitle="...">
 *     <MyChart />
 *   </ChartCard>
 */

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function ChartCard({ title, subtitle, children }: Props) {
  return (
    <section className="overflow-hidden rounded-sm border border-border bg-bg-elevated">
      <header className="bg-accent px-5 py-3 text-center sm:px-6 sm:py-4">
        <h2 className="text-lg font-extrabold tracking-tight text-bg sm:text-xl">
          {title}
        </h2>
      </header>
      {subtitle && (
        <p className="px-5 pt-3 text-center text-xs text-text-muted sm:px-6 sm:pt-4 sm:text-sm">
          {subtitle}
        </p>
      )}
      <div className="px-3 pb-3 pt-3 sm:px-5 sm:pb-5 sm:pt-4">{children}</div>
    </section>
  );
}
