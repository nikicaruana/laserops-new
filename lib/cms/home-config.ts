/**
 * lib/cms/home-config.ts
 * --------------------------------------------------------------------
 * Homepage content, read from Supabase (home_config, one row). Uses the
 * cookieless public client so the homepage stays statically / ISR rendered.
 * Every field falls back to DEFAULT_HOME_HERO, so the page renders correctly
 * even if the table is empty or the fetch fails. Edited from /admin/homepage.
 *
 * This is the first slice of moving the homepage off Google Sheets; more
 * homepage areas (featured photos, reviews selection) will join this config.
 */
import { createPublicClient } from "@/lib/supabase/public";

export type HeroStat = { value: string; label: string };

export type HomeHeroConfig = {
  lead: string;
  highlight: string;
  subhead: string;
  rating: string;
  reviewsLabel: string;
  reviewsUrl: string;
  ctaPrimaryLabel: string;
  ctaPrimaryHref: string;
  ctaSecondaryLabel: string;
  ctaSecondaryHref: string;
  stats: HeroStat[];
};

const GOOGLE_MAPS_URL =
  "https://www.google.com/maps/place/LaserOps+Malta/@35.9351506,14.0734794,11z/data=!4m12!1m2!2m1!1slaserops+malta!3m8!1s0x130e4ddaeadfe003:0xda30f052e79ffef8!8m2!3d35.9351506!4d14.37835!9m1!1b1!15sCg5sYXNlcm9wcyBtYWx0YVoQIg5sYXNlcm9wcyBtYWx0YZIBGm91dGRvb3JfYWN0aXZpdHlfb3JnYW5pemVymgFEQ2k5RFFVbFJRVU52WkVOb2RIbGpSamx2VDJwc2EyUkZSa3haYm1SYVpVaENTbVZHYkZWV1JscHlWVWRXTlZSSVl4QULgAQD6AQQIQBA6!16s%2Fg%2F11z6lk5clw!5m2!1e4!1e1?entry=ttu&g_ep=EgoyMDI2MDUwNi4wIKXMDSoASAFQAw%3D%3D";

/**
 * Baked-in defaults = the hero's original hardcoded copy. The CMS is seeded
 * with these, so migrating to it is a no-op visually until an admin edits.
 */
export const DEFAULT_HOME_HERO: HomeHeroConfig = {
  lead: "Malta's Ultimate Outdoor Laser Tag Experience.",
  highlight: "Built for Competition.",
  subhead:
    "Tactical missions, different scenarios, and Malta's only persistent stat and progressive unlock system. LaserOps is changing the game.",
  rating: "5.0",
  reviewsLabel: "on Google Reviews",
  reviewsUrl: GOOGLE_MAPS_URL,
  ctaPrimaryLabel: "Book a Game",
  ctaPrimaryHref: "/booking",
  // Recommended default: funnel new visitors into a free profile (the hero
  // sells the persistent-stats system) rather than straight to leaderboards.
  ctaSecondaryLabel: "Create your free profile",
  ctaSecondaryHref: "/player-portal/login",
  stats: [
    { value: "15+", label: "Weapons" },
    { value: "6+", label: "Game Modes" },
    { value: "Outdoor", label: "Real Terrain" },
  ],
};

function str(v: unknown, fallback: string): string {
  if (typeof v !== "string") return fallback;
  const t = v.trim();
  return t === "" ? fallback : t;
}

/**
 * Read the home hero config. Never throws – returns DEFAULT_HOME_HERO on any
 * failure (empty table, network error, Supabase not configured).
 */
export async function getHomeHeroConfig(): Promise<HomeHeroConfig> {
  try {
    const sb = createPublicClient();
    const { data } = await sb
      .from("home_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (!data) return DEFAULT_HOME_HERO;

    const d = DEFAULT_HOME_HERO;
    const stats: HeroStat[] = [
      { value: str(data.stat1_value, d.stats[0].value), label: str(data.stat1_label, d.stats[0].label) },
      { value: str(data.stat2_value, d.stats[1].value), label: str(data.stat2_label, d.stats[1].label) },
      { value: str(data.stat3_value, d.stats[2].value), label: str(data.stat3_label, d.stats[2].label) },
    ].filter((s) => s.value !== "" || s.label !== "");

    return {
      lead: str(data.hero_lead, d.lead),
      highlight: str(data.hero_highlight, d.highlight),
      subhead: str(data.hero_subhead, d.subhead),
      rating: str(data.hero_rating, d.rating),
      reviewsLabel: str(data.hero_reviews_label, d.reviewsLabel),
      reviewsUrl: str(data.hero_reviews_url, d.reviewsUrl),
      ctaPrimaryLabel: str(data.cta_primary_label, d.ctaPrimaryLabel),
      ctaPrimaryHref: str(data.cta_primary_href, d.ctaPrimaryHref),
      ctaSecondaryLabel: str(data.cta_secondary_label, d.ctaSecondaryLabel),
      ctaSecondaryHref: str(data.cta_secondary_href, d.ctaSecondaryHref),
      stats: stats.length > 0 ? stats : d.stats,
    };
  } catch {
    return DEFAULT_HOME_HERO;
  }
}
