import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/**
 * CollapsibleSection
 * --------------------------------------------------------------------
 * Reusable section wrapper for player-portal leaderboard tables.
 *
 * Architecture:
 *   - Built on native <details>/<summary> for free accessibility:
 *     keyboard support, screen reader semantics, no ARIA gymnastics.
 *   - Smooth open/close animation via CSS `interpolate-size: allow-keywords`
 *     and `::details-content` (modern browsers — Chrome 129+, Firefox 137+,
 *     Safari 18.2+). Older browsers snap open/closed gracefully.
 *   - Animation styles live in globals.css under `.collapsible-section` to
 *     keep this component as JSX-light as possible.
 *
 * Visual treatment:
 *   - Custom triangle indicator (yellow chevron) — rotates 90° when open.
 *     Native marker hidden via `list-style: none` (and Safari prefix).
 *   - Whole summary row is clickable (not just the triangle).
 *   - Section is open by default — pass `defaultOpen={false}` to start closed.
 *
 * Use it wrapping a leaderboard table. The summary is the table's title;
 * children are the table itself.
 */

type CollapsibleSectionProps = {
  /** Section title — appears in the summary row and acts as the click target. */
  title: ReactNode;
  /**
   * Whether the section starts open. Default true.
   *
   * NOTE: this only controls the *initial* render. After hydration, the user's
   * open/close interaction takes over via the native details element. We do
   * NOT track this in React state — letting the browser own it keeps the JS
   * minimal and matches the platform's native behavior.
   */
  defaultOpen?: boolean;
  /** The collapsible content — typically a leaderboard table. */
  children: ReactNode;
  /** Optional pass-through for layout containers wrapping the section. */
  className?: string;
};

export function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
  className,
}: CollapsibleSectionProps) {
  return (
    <details
      open={defaultOpen}
      className={cn("collapsible-section", className)}
    >
      <summary
        className={cn(
          // Reset native marker styling — we provide our own indicator
          "list-none [&::-webkit-details-marker]:hidden",
          // Layout: indicator + title, click target spans full row
          "flex cursor-pointer select-none items-center gap-3 py-3",
          // Centered to match the rest of the player-portal aesthetic
          "justify-center",
        )}
      >
        {/* Yellow chevron — points right when collapsed, rotates 90° to point
            down when the parent <details> is open. Rotation handled in
            globals.css so we don't depend on a specific Tailwind variant. */}
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          className="collapsible-chevron h-3 w-3 shrink-0 text-accent transition-transform duration-200"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 2l4 4-4 4" strokeLinecap="square" strokeLinejoin="miter" />
        </svg>
        <h2 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
          {title}
        </h2>
      </summary>

      {/* The animated content area. The height/visibility transition is keyed
          to ::details-content in globals.css. */}
      <div className="pt-2">{children}</div>
    </details>
  );
}
