import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
