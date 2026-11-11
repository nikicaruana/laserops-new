import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // pdfkit loads its own font data at runtime; keep it external so bundling
  // doesn't break that. The voucher-PDF route also reads the brand logo + the
  // Montserrat TTFs from disk, so trace those files into that function.
  // pdfkit dynamically require()s its standard-font modules (e.g.
  // standard-fonts/Helvetica.cjs) when a PDFDocument is constructed; the dynamic
  // require is invisible to Vercel's file tracer, so those files must be traced
  // explicitly or generation 500s with "Cannot find module ... Helvetica.cjs".
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/admin/vouchers/pdf": [
      "./public/fonts/Montserrat-*.ttf",
      "./public/brand/laserops-wordmark-print.png",
      // pdfkit's standard fonts require nested CJS chunks (e.g.
      // standard-fonts/chunks/standardGlyphNames-*.cjs); trace every pdfkit CJS
      // file so none of its dynamic requires 500 the function.
      "./node_modules/pdfkit/js/**/*.cjs",
      "./node_modules/pdfkit/js/data/*.afm",
    ],
  },
  // Lint runs in the editor/CI, not during the production build (a stale
  // eslint-disable directive for an unconfigured rule was failing `next build`).
  eslint: { ignoreDuringBuilds: true },
  // Recharts ships ESM-only modules that historically have had compat
  // issues with Next.js's default bundling. Adding it to transpilePackages
  // tells Next to bundle and transform recharts through SWC, sidestepping
  // any "module not found" or "unexpected token" errors at runtime.
  // Harmless if not strictly required.
  transpilePackages: ["recharts"],
  images: {
    formats: ["image/avif", "image/webp"],
    // Allowlisted external image hosts. Required by Next.js <Image>
    // for security – only hostnames listed here can be optimised by
    // the next/image pipeline. Plain <img> tags don't require this.
    //
    // postimg.cc is where LaserOps hosts everything: profile pics,
    // rank badges, accolade icons, team badges, gallery images, etc.
    // If you start hosting images elsewhere (your own CDN, S3, etc.)
    // add another remotePatterns entry for that hostname.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.postimg.cc",
      },
      // Cloudinary-hosted gallery images.
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
