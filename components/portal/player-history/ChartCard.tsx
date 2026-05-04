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
 * CHANGE in this pass: dropped the inner body padding on mobile so
 * the chart can use the full viewport width. Combined with the page-
 * level container's existing horizontal padding, the chart was sitting
 * inside ~28px of dead space on each side on phones — a meaningful
 * chunk of a 380px viewport. On desktop the inner padding stays
 * because the chart already has plenty of width and the inner gutter
 * helps separate the chart from the card border visually.
 *
 * The subtitle and header keep their padding so the text doesn't
 * touch the card edges. Only the chart body goes full-bleed on mobile.
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
      {/* Chart body. Mobile: edge-to-edge (px-0) so recharts gets the
          full card width. Desktop: restore px-5 so the chart sits
          inside a comfortable gutter. */}
      <div className="px-0 pb-3 pt-3 sm:px-5 sm:pb-5 sm:pt-4">{children}</div>
    </section>
  );
}
