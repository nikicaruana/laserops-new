import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Recharts ships ESM-only modules that historically have had compat
  // issues with Next.js's default bundling. Adding it to transpilePackages
  // tells Next to bundle and transform recharts through SWC, sidestepping
  // any "module not found" or "unexpected token" errors at runtime.
  // Harmless if not strictly required.
  transpilePackages: ["recharts"],
  images: {
    formats: ["image/avif", "image/webp"],
    // Allowlisted external image hosts. Required by Next.js <Image>
    // for security — only hostnames listed here can be optimised by
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
    ],
  },
};

export default nextConfig;
