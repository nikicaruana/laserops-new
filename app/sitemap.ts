import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";
import { fetchImagesByTag } from "@/lib/cloudinary";

/**
 * sitemap.ts
 * --------------------------------------------------------------------
 * Generates /sitemap.xml. Next.js serialises this at build time.
 *
 * Only canonical, indexable, 200-status URLs belong here. We deliberately
 * exclude redirect-only routes (/events, /player-portal*) and the player
 * portal/dashboards (dynamic player data, partly disallowed in robots.txt) —
 * a sitemap should list the pages we actually want ranked.
 *
 * Priorities (a weak relative signal):
 *   1.0  Homepage
 *   0.9  Primary landing + conversion (Outdoor Laser Tag, Booking)
 *   0.8  Marketing + community pages
 *   0.6  Supporting info pages (About, FAQs, Contact, Gallery)
 *   0.4  Match Report (tool page)
 *   0.2  Legal pages
 *
 * Update this file whenever a new public route is added.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = brand.siteUrl.replace(/\/$/, "");
  const now = new Date();

  function url(
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "monthly",
    images?: string[],
  ): MetadataRoute.Sitemap[number] {
    return {
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency,
      priority,
      ...(images && images.length > 0 ? { images } : {}),
    };
  }

  // Hero image for the Outdoor Laser Tag page — surfaced in the sitemap
  // for image SEO. Fails soft to no image if the tag/creds are unavailable.
  const oltHero = await fetchImagesByTag("olt-hero");
  const oltHeroUrl = oltHero[0]?.secureUrl;

  return [
    url("/",                          1.0, "weekly"),
    url("/outdoor-laser-tag-malta",   0.9, "monthly", oltHeroUrl ? [oltHeroUrl] : undefined),
    url("/booking",                   0.9, "monthly"),
    url("/weapons",                   0.8, "monthly"),
    url("/community",                 0.8, "weekly"),
    url("/events/corporate",          0.8, "monthly"),
    url("/stag-and-hen",              0.8, "monthly"),
    url("/birthday-parties",          0.8, "monthly"),
    url("/events/open-games",         0.8, "weekly"),
    url("/gallery",                   0.6, "weekly"),
    url("/who-we-are",                0.6, "monthly"),
    url("/faqs",                      0.6, "monthly"),
    url("/contact",                   0.6, "monthly"),
    url("/match-report",              0.4, "monthly"),
    url("/privacy",                   0.2, "yearly"),
    url("/cookies",                   0.2, "yearly"),
  ];
}
