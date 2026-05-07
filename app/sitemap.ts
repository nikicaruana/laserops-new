import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";

/**
 * sitemap.ts
 * --------------------------------------------------------------------
 * Generates /sitemap.xml. Next.js serialises this at build time.
 *
 * Priorities follow rough content importance:
 *   1.0  Homepage
 *   0.8  High-value marketing + community pages
 *   0.7  Supporting info pages (About, FAQs, Contact)
 *   0.6  Portal entry points (crawlers shouldn't need to index player data)
 *   0.5  Match Report (tool page, low discovery value)
 *
 * Update this file whenever a new public route is added.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = brand.siteUrl.replace(/\/$/, "");
  const now = new Date();

  function url(
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "monthly",
  ): MetadataRoute.Sitemap[number] {
    return {
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency,
      priority,
    };
  }

  return [
    url("/",                              1.0, "weekly"),
    url("/weapons",                       0.8, "monthly"),
    url("/gallery",                       0.8, "weekly"),
    url("/community",                     0.8, "monthly"),
    url("/events",                        0.8, "monthly"),
    url("/events/corporate",              0.8, "monthly"),
    url("/events/stag-hen",               0.8, "monthly"),
    url("/events/birthdays",              0.8, "monthly"),
    url("/about",                         0.7, "monthly"),
    url("/faqs",                          0.7, "monthly"),
    url("/contact",                       0.7, "monthly"),
    url("/player-portal",                 0.6, "weekly"),
    url("/player-portal/leaderboards",    0.6, "weekly"),
    url("/player-portal/player-stats",    0.6, "monthly"),
    url("/match-report",                  0.5, "monthly"),
  ];
}
