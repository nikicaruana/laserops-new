import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";
import { isStagingHost } from "@/lib/staging-gate";

/**
 * robots.ts
 * --------------------------------------------------------------------
 * Generates /robots.txt. Allows all crawlers and points them to the
 * sitemap for efficient discovery.
 *
 * Portal paths that contain per-player data don't need to be indexed – they
 * require a search param (?ops=…) to show anything useful, and Google would
 * likely treat them as thin content. Disallow those paths to save crawl budget.
 *
 * On a staging deployment (STAGING_GATE=1, or a staging/preview host) we
 * disallow everything so the pre-launch site never gets indexed – custom
 * aliases are not auto-noindexed the way random preview URLs are.
 */
export default function robots(): MetadataRoute.Robots {
  const base = brand.siteUrl.replace(/\/$/, "");

  if (isStagingHost()) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/player-portal/player-stats/", "/api/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
