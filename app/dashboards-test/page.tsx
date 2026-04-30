import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "All-Time XP Leaderboard",
  // Don't index test pages in search engines
  robots: { index: false, follow: false },
};

/**
 * TEST PAGE — /dashboards-test
 *
 * Verifies that an embedded Looker Studio iframe renders cleanly inside
 * the site's design language. Not linked from anywhere yet — only accessible
 * via direct URL.
 *
 * Once we confirm the embed pattern works, this becomes the template for
 * /dashboards and the per-report subpages.
 */

const LEADERBOARD_EMBED_URL =
  "https://datastudio.google.com/embed/reporting/564e652f-715a-48ee-ac6c-edf694760770/page/rPvwF";

// Looker canvas dimensions — match what was set in the report
const CANVAS_WIDTH = 950;
const CANVAS_HEIGHT = 600;
const ASPECT_RATIO = CANVAS_HEIGHT / CANVAS_WIDTH; // ~0.632

export default function DashboardsTestPage() {
  return (
    <div className="bg-bg">
      <Container size="wide" className="pt-12 pb-20 sm:pt-16 sm:pb-28 lg:pt-24 lg:pb-32">
        {/* Page header */}
        <div className="mb-10 sm:mb-14">
          <div className="flex items-center gap-3">
            <span aria-hidden className="block h-px w-12 bg-accent" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Global Stats
            </span>
          </div>
          <h1 className="mt-4 text-balance text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">
            All-Time XP Leaderboard
          </h1>
          <p className="mt-4 max-w-2xl text-base text-text-muted sm:text-lg">
            The top operatives by total experience earned across every season.
          </p>
        </div>

        {/* Iframe wrapper.
            Strategy: aspect-ratio container with width: 100% up to native canvas size.
            On screens >= 950px the iframe renders at native size (950×600).
            On smaller screens it scales proportionally, browser handles the scaling.
            We add yellow corner brackets via pseudo-elements / overlays for a
            site-native frame without putting anything inside the iframe. */}
        <div className="relative mx-auto" style={{ maxWidth: CANVAS_WIDTH }}>
          {/* Yellow corner brackets — top-left and bottom-right for asymmetric tactical feel */}
          <div className="pointer-events-none absolute -inset-px z-10">
            {/* Top-left bracket */}
            <span aria-hidden className="absolute left-0 top-0 h-[2px] w-5 bg-accent" />
            <span aria-hidden className="absolute left-0 top-0 h-5 w-[2px] bg-accent" />
            {/* Bottom-right bracket */}
            <span aria-hidden className="absolute bottom-0 right-0 h-[2px] w-5 bg-accent" />
            <span aria-hidden className="absolute bottom-0 right-0 h-5 w-[2px] bg-accent" />
          </div>

          {/* Aspect-ratio box. The iframe is rendered ~36px taller than
              visible so the Looker watermark sits below the clip line.
              Wrapper background matches the Looker report's interior
              (#141414) so the clipped area is seamless with the leaderboard. */}
          <div
            className="relative w-full overflow-hidden bg-bg-elevated"
            style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
          >
            <iframe
              src={LEADERBOARD_EMBED_URL}
              title="All-Time XP Leaderboard"
              loading="lazy"
              allowFullScreen
              className="absolute inset-x-0 top-0 w-full border-0"
              style={{ height: "calc(100% + 36px)" }}
              sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            />
          </div>
        </div>

        {/* Note to user */}
        <p className="mx-auto mt-6 max-w-2xl text-center text-xs uppercase tracking-[0.16em] text-text-subtle">
          Data updates from the live tournament records
        </p>
      </Container>
    </div>
  );
}
