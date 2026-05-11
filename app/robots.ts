import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";

/**
 * robots.ts
 * --------------------------------------------------------------------
 * Generates /robots.txt. Allows all crawlers and points them to the
 * sitemap for efficient discovery.
 *
 * Portal/dashboard paths that contain per-player data don't need to be
 * indexed — they require a search param (?ops=…) to show anything
 * useful, and Google would likely treat them as thin content. Disallow
 * those paths to save crawl budget.
 */
export default function robots(): MetadataRoute.Robots {
  const base = brand.siteUrl.replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/player-portal/player-stats/",
          "/dashboards/",
          "/api/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
