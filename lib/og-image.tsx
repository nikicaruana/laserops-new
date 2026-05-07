import { ImageResponse } from "next/og";

/**
 * lib/og-image.tsx
 * --------------------------------------------------------------------
 * Shared Open Graph card generator. Mirrors the desktop hero:
 *   - Full-bleed yellow graffiti background (desktop-hero-01-bg.png)
 *   - B&W branded figure anchored bottom-right (same hover variant)
 *   - Black wordmark logo top-left
 *   - Page title (Montserrat 800) below the logo
 *   - "TACTICAL LASER TAG · MALTA" tagline beneath
 *
 * Usage in app/{route}/opengraph-image.tsx:
 *   export const runtime = "edge";
 *   export const size = { width: 1200, height: 630 };
 *   export const contentType = "image/png";
 *   export default function Image() { return generateOgImage("About Us"); }
 *
 * Asset URLs must be absolute — required by the edge runtime's ImageResponse.
 * The helper `assetBase()` resolves the correct origin for all environments.
 */

/**
 * Resolve the public-asset base URL for the current environment.
 *   1. NEXT_PUBLIC_SITE_URL (production / .env.local)
 *   2. VERCEL_URL  (Vercel preview deployments — auto-injected)
 *   3. localhost:3000 (local dev fallback)
 */
function assetBase(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Fetch Montserrat ExtraBold (800) from Google Fonts for use inside
 * ImageResponse. The CSS2 API returns a woff2 src URL; we extract and
 * fetch the binary. The edge runtime caches this automatically.
 */
async function loadMontserrat(): Promise<ArrayBuffer> {
  const css = await fetch(
    "https://fonts.googleapis.com/css2?family=Montserrat:wght@800&display=swap",
    {
      headers: {
        // A real browser UA is required — Google Fonts serves woff2 to
        // modern browsers but falls back to woff/ttf for old UAs.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    },
  ).then((r) => r.text());

  const match = css.match(/src: url\((.+?)\) format/);
  if (!match) throw new Error("[og-image] Could not extract font URL from Google Fonts CSS");

  return fetch(match[1]).then((r) => r.arrayBuffer());
}

export async function generateOgImage(title: string): Promise<ImageResponse> {
  const fontData = await loadMontserrat();
  const base = assetBase();

  return new ImageResponse(
    (
      // Root must be display:flex and have explicit size so satori lays
      // out correctly. overflow:hidden clips the oversized figure.
      <div
        style={{
          position: "relative",
          display: "flex",
          width: "1200px",
          height: "630px",
          overflow: "hidden",
          // Fallback colour in case the background PNG is slow/missing
          background: "#ffde00",
        }}
      >
        {/* ── Layer 1: yellow graffiti texture (hero bg) ─────── */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${base}/images/hero/desktop-hero-01-bg.png`}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />

        {/* ── Layer 2: subtle left-side dark scrim (text legibility) ── */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "linear-gradient(to right, rgba(0,0,0,0.20) 0%, transparent 52%)",
            display: "flex",
          }}
        />

        {/* ── Layer 3: B&W branded figure — bottom-right ──────── */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${base}/images/hero/desktop-hero-01-figure-branded.png`}
          alt=""
          style={{
            position: "absolute",
            right: "-24px",
            bottom: 0,
            height: "108%",
            objectFit: "contain",
            objectPosition: "bottom right",
          }}
        />

        {/* ── Layer 4: text content — top-left ────────────────── */}
        <div
          style={{
            position: "absolute",
            top: "58px",
            left: "64px",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
          }}
        >
          {/* Black wordmark logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${base}/brand/laserops-logo-black.png`}
            alt="LaserOps Malta"
            style={{ width: "256px", height: "auto", display: "flex" }}
          />

          {/* Page title */}
          <div
            style={{
              marginTop: "28px",
              fontFamily: "Montserrat",
              fontWeight: 800,
              fontSize: "80px",
              color: "#0a0a0a",
              letterSpacing: "-0.02em",
              lineHeight: 1,
              display: "flex",
            }}
          >
            {title}
          </div>

          {/* Tagline */}
          <div
            style={{
              marginTop: "16px",
              fontFamily: "Montserrat",
              fontWeight: 800,
              fontSize: "15px",
              color: "#3a3a3a",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            TACTICAL LASER TAG · MALTA
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Montserrat",
          data: fontData,
          weight: 800,
          style: "normal",
        },
      ],
    },
  );
}
