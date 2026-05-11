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
 * Reads the same env var as brand.siteUrl so they always agree.
 */
function assetBase(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Load Montserrat ExtraBold (800) from the locally-hosted font file at
 * /public/fonts/montserrat-800.woff2. Serving it ourselves avoids the
 * unreliable Google Fonts round-trip inside the edge runtime.
 */
async function loadMontserrat(base: string): Promise<ArrayBuffer> {
  const res = await fetch(`${base}/fonts/montserrat-800.woff2`);
  if (!res.ok) throw new Error(`[og-image] Font fetch failed: ${res.status}`);
  return res.arrayBuffer();
}

export async function generateOgImage(title: string): Promise<ImageResponse> {
  const base = assetBase();

  try {
    return await buildOgImage(title, base);
  } catch (err) {
    console.error("[og-image] Generation failed, returning fallback:", err);
    // Plain yellow fallback so we never return a 0-byte response.
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "1200px",
            height: "630px",
            background: "#ffde00",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: "64px", fontWeight: 800, color: "#0a0a0a", display: "flex" }}>
            LaserOps Malta
          </div>
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }
}

async function buildOgImage(title: string, base: string): Promise<ImageResponse> {
  const fontData = await loadMontserrat(base);

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
          {/* Black wordmark logo — explicit height required; Satori does not support height:auto */}
          <img
            src={`${base}/brand/laserops-logo-black.png`}
            alt="LaserOps Malta"
            style={{ width: "256px", height: "64px", display: "flex" }}
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
