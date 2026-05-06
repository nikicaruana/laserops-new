/**
 * Single source of truth for site navigation.
 * Changing a link here updates the header, mobile nav, footer, and (eventually) the sitemap.
 */

export type NavChild = {
  label: string;
  href: string;
};

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
  /** Optional dropdown children shown on desktop hover and mobile accordion. */
  children?: NavChild[];
  /**
   * Mobile-only: instead of rendering this item as an accordion group,
   * explode its children as individual top-level items in the mobile nav.
   * The parent itself is hidden. Children inherit the parent's color.
   */
  mobileExpand?: boolean;
};

export const primaryNav: NavLink[] = [
  { label: "Weapons", href: "/weapons" },
  {
    label: "Events",
    href: "/events",
    children: [
      { label: "Corporate Events", href: "/events/corporate" },
      { label: "Stag & Hen Dos", href: "/events/stag-hen" },
      { label: "Birthday Parties", href: "/events/birthdays" },
    ],
  },
  { label: "Community", href: "/community" },
  { label: "Gallery", href: "/gallery" },
  {
    label: "Player Portal",
    href: "/player-portal",
    highlight: true,
    mobileExpand: true,
    children: [
      { label: "Leaderboards", href: "/player-portal/leaderboards" },
      { label: "Player Stats", href: "/player-portal/player-stats" },
      { label: "Match Report", href: "/match-report" },
    ],
  },
  {
    label: "About",
    href: "/about",
    children: [
      { label: "Who We Are", href: "/about" },
      { label: "FAQs", href: "/faqs" },
      { label: "Contact", href: "/contact" },
    ],
  },
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
