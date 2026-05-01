/**
 * DashboardFrame
 * --------------------------------------------------------------------
 * Reusable wrapper for an embedded Looker Studio report.
 *
 * Design rules learned from /dashboards-test:
 *   - Wrapper bg matches Looker page bg (#141414 / bg-elevated) so the
 *     watermark band we clip from the bottom is seamless.
 *   - Iframe is rendered ~36px taller than the visible wrapper so the
 *     Looker watermark sits below the clip line. 36px is a *rendered*
 *     pixel value — robust across viewport sizes.
 *   - Yellow corner brackets (top-left + bottom-right) framing the box
 *     for site-native chrome — desktop only. On mobile the frame goes
 *     edge-to-edge, no brackets.
 *
 * Canvas is now 950×1200 (resized from 950×600). All math derives from
 * the props so future reports can override.
 */

type DashboardFrameProps = {
  /** Looker Studio embed URL — full URL including /embed/reporting/.../page/... */
  embedUrl: string;
  /** Accessible iframe title — describe the report ("XP / Levels Leaderboard") */
  title: string;
  /** Native canvas width in Looker (px). Default 950. */
  canvasWidth?: number;
  /** Native canvas height in Looker (px). Default 1200. */
  canvasHeight?: number;
};

/**
 * Empirically-determined overshoot to push the Looker watermark below the
 * visible clip line. Measured in *rendered* pixels (post-scale), which is
 * what matters because the watermark renders at fixed pixel size.
 */
const WATERMARK_OVERSHOOT_PX = 36;

export function DashboardFrame({
  embedUrl,
  title,
  canvasWidth = 950,
  canvasHeight = 1200,
}: DashboardFrameProps) {
  return (
    // Edge-to-edge bleed on mobile via negative margins that cancel the
    // dashboard layout's horizontal padding. On sm+ we reset to flow normally
    // and let the parent container's max-width center the frame.
    // The -mx-4 matches our dashboard layout's px-4; sm:mx-0 restores normal flow.
    <div className="-mx-4 sm:mx-0">
      <div
        className="relative mx-auto"
        style={{ maxWidth: canvasWidth }}
      >
        {/* Yellow corner brackets — desktop only. On mobile the frame is
            edge-to-edge so brackets would clip awkwardly. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-px z-10 hidden sm:block"
        >
          {/* Top-left bracket */}
          <span className="absolute left-0 top-0 h-[2px] w-5 bg-accent" />
          <span className="absolute left-0 top-0 h-5 w-[2px] bg-accent" />
          {/* Bottom-right bracket */}
          <span className="absolute bottom-0 right-0 h-[2px] w-5 bg-accent" />
          <span className="absolute bottom-0 right-0 h-5 w-[2px] bg-accent" />
        </div>

        {/* Aspect-ratio container.
            Wrapper bg matches Looker page bg so the strip we clip is invisible. */}
        <div
          className="relative w-full overflow-hidden bg-bg-elevated"
          style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}
        >
          <iframe
            src={embedUrl}
            title={title}
            loading="lazy"
            allowFullScreen
            className="absolute inset-x-0 top-0 w-full border-0"
            style={{ height: `calc(100% + ${WATERMARK_OVERSHOOT_PX}px)` }}
            sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          />
        </div>
      </div>
    </div>
  );
}
