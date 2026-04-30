import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    // Future: add remote image domains here when fetching from CMS/CDN
    remotePatterns: [],
  },
};

export default nextConfig;
