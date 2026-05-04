/**
 * Single source of truth for site navigation.
 * Changing a link here updates the header, mobile nav, footer, and (eventually) the sitemap.
 */

export type NavLink = {
  label: string;
  href: string;
  /** Excluded from main nav, but still tracked here for routing/sitemap purposes */
  hidden?: boolean;
  /** Render in brand yellow to draw attention. Use sparingly — at most one. */
  highlight?: boolean;
  /** Render in muted red (red-800). Mirrors the "Level X ▶ Y" red used
   *  on the Match Report XP card so the nav and the feature share a
   *  visual tie. Mutually exclusive with `highlight` — don't set both. */
  redHighlight?: boolean;
};

export const primaryNav: NavLink[] = [
  { label: "Game Modes", href: "/game-modes" },
  { label: "Weapons", href: "/weapons" },
  { label: "Locations", href: "/locations" },
  { label: "Events", href: "/events" },
  { label: "Player Portal", href: "/player-portal", highlight: true },
  { label: "Match Report", href: "/match-report", redHighlight: true },
  { label: "About", href: "/about" },
];

export const utilityNav: NavLink[] = [
  { label: "Contact", href: "/contact" },
  { label: "Privacy", href: "/privacy" },
  { label: "Cookies", href: "/cookies" },
];

export const ctaLinks = {
  primary: { label: "Book a Game", href: "/booking" },
  secondary: { label: "View Leaderboards", href: "/player-portal" },
};
