import type { MetadataRoute } from "next";

/**
 * Web App Manifest.
 * --------------------------------------------------------------------
 * Exported as a TypeScript MetadataRoute.Manifest, which Next.js renders
 * to /manifest.webmanifest at build time. Browsers fetch this manifest
 * to learn the app's name, icons, theme colour, and "add to home screen"
 * behaviour.
 *
 * Icon set served from /public/icons/:
 *   - 192px and 512px PNGs for Android / PWA installs (yellow on
 *     transparent — Android handles transparency cleanly)
 *   - 180px apple-touch-icon (yellow on dark bg) wired separately via
 *     the root layout's metadata, since Apple uses its own <link> tag
 *     rather than reading from this manifest.
 *
 * theme_color: the brand black. Used by Android Chrome to tint the
 * address bar / splash screen. Brand yellow would be too bright as
 * chrome.
 *
 * background_color: same as theme_color so PWA install splash stays
 * cohesive with the dark site aesthetic.
 *
 * display: 'standalone' — when installed as a PWA, opens in its own
 * window without browser chrome. Most native-feeling option.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LaserOps Malta",
    short_name: "LaserOps",
    description: "Outdoor tactical laser tag in Malta — player portal and stats.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
