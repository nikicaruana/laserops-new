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
 *   - 192px and 512px PNGs for Android / PWA installs.
 *   - 180px apple-touch-icon wired separately via the root layout's
 *     metadata, since Apple uses its own <link> tag rather than reading
 *     from this manifest.
 *
 * Icon design: black target silhouette on solid yellow square. Solid
 * background (rather than transparent) means the icon looks the same
 * on every phone regardless of light/dark theme — no system-coloured
 * tile bleeding through. Yellow square is also the most distinctive
 * brand cue, so the icon reads as LASEROPS at a glance even at small
 * sizes.
 *
 * theme_color: brand black. Used by Android Chrome to tint the address
 * bar / splash screen. Brand yellow would be too bright as chrome.
 *
 * background_color: matches theme_color so PWA install splash stays
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
