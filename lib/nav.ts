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
};

export const primaryNav: NavLink[] = [
  { label: "Game Modes", href: "/game-modes" },
  { label: "Weapons", href: "/weapons" },
  { label: "Locations", href: "/locations" },
  { label: "Events", href: "/events" },
  { label: "Dashboards", href: "/dashboards", highlight: true },
  { label: "About", href: "/about" },
];

export const utilityNav: NavLink[] = [
  { label: "Contact", href: "/contact" },
  { label: "Privacy", href: "/privacy" },
  { label: "Cookies", href: "/cookies" },
];

export const ctaLinks = {
  primary: { label: "Book a Game", href: "/booking" },
  secondary: { label: "View Leaderboards", href: "/dashboards" },
};
