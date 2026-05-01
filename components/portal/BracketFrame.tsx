import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/**
 * BracketFrame
 * --------------------------------------------------------------------
 * Yellow corner-bracket frame used to highlight key visual content in
 * the player portal — profile photos, weapon images, hero images. It's
 * the project's standard "tactical highlight" treatment.
 *
 * Visually: four L-shaped yellow brackets at the corners of the content,
 * not a full border. Inspired by HUD targeting reticles in shooters.
 *
 * Sizing: caller controls dimensions via children (e.g. an <img> with its
 * own height/width). The frame absolute-positions over the content. Use
 * a wrapper if you need padding between the frame and the content edge.
 */

type BracketFrameProps = {
  children: ReactNode;
  /** Size of each L-shaped corner in CSS units. Default 1.25rem (20px). */
  cornerSize?: string;
  /** Stroke thickness of the L. Default 2px. */
  thickness?: string;
  /** Negative inset so brackets sit slightly outside the content edge. Default 0 (flush). */
  inset?: string;
  className?: string;
};

export function BracketFrame({
  children,
  cornerSize = "1.25rem",
  thickness = "2px",
  inset = "0",
  className,
}: BracketFrameProps) {
  return (
    <div className={cn("relative inline-block align-top", className)}>
      {children}
      {/* Bracket overlay — pointer-events-none so it doesn't interfere with
          interactive content beneath. inset shifts the brackets slightly
          outside the frame for a more deliberate "marker" feel. */}
      <span
        aria-hidden
        className="pointer-events-none absolute"
        style={{ inset }}
      >
        {/* Top-left corner */}
        <span
          className="absolute left-0 top-0 bg-accent"
          style={{ width: cornerSize, height: thickness }}
        />
        <span
          className="absolute left-0 top-0 bg-accent"
          style={{ width: thickness, height: cornerSize }}
        />
        {/* Top-right corner */}
        <span
          className="absolute right-0 top-0 bg-accent"
          style={{ width: cornerSize, height: thickness }}
        />
        <span
          className="absolute right-0 top-0 bg-accent"
          style={{ width: thickness, height: cornerSize }}
        />
        {/* Bottom-left corner */}
        <span
          className="absolute bottom-0 left-0 bg-accent"
          style={{ width: cornerSize, height: thickness }}
        />
        <span
          className="absolute bottom-0 left-0 bg-accent"
          style={{ width: thickness, height: cornerSize }}
        />
        {/* Bottom-right corner */}
        <span
          className="absolute bottom-0 right-0 bg-accent"
          style={{ width: cornerSize, height: thickness }}
        />
        <span
          className="absolute bottom-0 right-0 bg-accent"
          style={{ width: thickness, height: cornerSize }}
        />
      </span>
    </div>
  );
}
