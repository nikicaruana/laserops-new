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
 * --------------------------------------------------------------------
 * MOBILE PADDING (post pass-10)
 *
 * Pass 4 set body padding to px-0 on mobile to claw back as much
 * chart width as possible. Side effect: the Y-axis tick labels
 * ("1095", "1.5k", etc.) ended up flush against the card border,
 * and the rightmost data labels on the ELO chart clipped against
 * the right edge.
 *
 * The fix is a thin horizontal pad on mobile — 8px left, 4px right.
 * Asymmetric because:
 *   - Y-axis ticks live on the LEFT (need a hairline of breathing
 *     room from the card border to be readable).
 *   - The recharts plot area runs to the RIGHT edge of the chart;
 *     a tiny right pad just keeps text labels from clipping the
 *     border without giving back chart width.
 *
 * Total mobile padding given back: 12px (1.2% of a 380px viewport).
 * Charts still use ~96% of available width. Big improvement on the
 * pre-pass-4 ~28px each side.
 * --------------------------------------------------------------------
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
      {/* Chart body. Mobile: pl-2 pr-1 (8 / 4px) — minimal inset so
          axis labels don't kiss the card border but charts get most
          of the width. Desktop: px-5 unchanged. */}
      <div className="pb-3 pl-2 pr-1 pt-3 sm:px-5 sm:pb-5 sm:pt-4">
        {children}
      </div>
    </section>
  );
}
