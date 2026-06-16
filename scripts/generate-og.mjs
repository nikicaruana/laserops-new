/**
 * scripts/generate-og.mjs
 * --------------------------------------------------------------------
 * Pre-generates per-page Open Graph share cards as static PNGs using
 * the same engine as next/og (satori for layout) + sharp for raster.
 *
 * We generate STATIC files (rather than a dynamic opengraph-image.tsx
 * route) because @vercel/og's runtime font loader is unreliable here
 * (it 500s on Windows dev with an Invalid-URL on its bundled fallback
 * font), and static cards are bulletproof + verifiable.
 *
 * Each card is written as app/<route>/opengraph-image.png — Next's file
 * convention then auto-emits the og:image meta tags (correct absolute
 * URL + dimensions), so no per-page metadata is needed.
 *
 * Re-run after changing any card title:  npm run generate:og
 * --------------------------------------------------------------------
 */
import satori from "satori";
import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const font = readFileSync(join(ROOT, "public/fonts/montserrat-800.ttf"));
const logo = readFileSync(join(ROOT, "public/brand/laserops-logo-yellow.png"));
const logoUri = "data:image/png;base64," + logo.toString("base64");

// route dir (under app/) -> card title. "" is the homepage (app/opengraph-image.png).
const PAGES = {
  "": "Malta's Ultimate Outdoor Laser Tag",
  "outdoor-laser-tag-malta": "Outdoor Laser Tag in Malta",
  weapons: "15+ Tactical Laser Tag Weapons",
  community: "Malta's Laser Tag Community",
  "events/corporate": "Corporate Events & Team Building",
  "stag-and-hen": "Stag & Hen Dos in Malta",
  "birthday-parties": "Laser Tag Birthday Parties",
  "events/open-games": "Upcoming Open Games",
  booking: "Book a Laser Tag Session",
  gallery: "LaserOps in Action",
  "who-we-are": "Who We Are",
  faqs: "Laser Tag FAQs",
  contact: "Get in Touch",
};

function card(title) {
  return {
    type: "div",
    props: {
      style: {
        height: "100%", width: "100%", display: "flex", flexDirection: "column",
        justifyContent: "space-between", backgroundColor: "#0a0a0a",
        padding: "72px 80px", fontFamily: "Montserrat",
      },
      children: [
        { type: "img", props: { src: logoUri, width: 360, height: 65, style: { display: "flex" } } },
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column" },
            children: [
              { type: "div", props: { style: { width: 96, height: 8, backgroundColor: "#ffde00", marginBottom: 30, display: "flex" } } },
              { type: "div", props: { style: { display: "flex", fontSize: 68, fontWeight: 800, color: "#ffffff", lineHeight: 1.04, letterSpacing: "-0.02em", maxWidth: 1000 }, children: title } },
            ],
          },
        },
        {
          type: "div",
          props: {
            style: { display: "flex", alignItems: "center", justifyContent: "space-between" },
            children: [
              { type: "div", props: { style: { display: "flex", fontSize: 24, fontWeight: 800, color: "#ffde00", textTransform: "uppercase", letterSpacing: "0.16em" }, children: "Tactical Outdoor Laser Tag · Malta" } },
              { type: "div", props: { style: { display: "flex", fontSize: 24, fontWeight: 800, color: "#0a0a0a", backgroundColor: "#ffde00", padding: "14px 28px", borderRadius: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }, children: "Book a Game" } },
            ],
          },
        },
      ],
    },
  };
}

for (const [route, title] of Object.entries(PAGES)) {
  const svg = await satori(card(title), {
    width: 1200,
    height: 630,
    fonts: [{ name: "Montserrat", data: font, weight: 800, style: "normal" }],
  });
  const dest = route
    ? join(ROOT, "app", route, "opengraph-image.png")
    : join(ROOT, "app", "opengraph-image.png");
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(dest, png);
  console.log(`✓ ${route || "(home)"}/opengraph-image.png  "${title}"`);
}
console.log("Done.");
