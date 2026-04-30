/**
 * Brand-level constants used across the site.
 * Centralizing these means a single edit propagates everywhere
 * (SEO metadata, footer, structured data, social tags).
 */

export const brand = {
  name: "LaserOps",
  fullName: "LaserOps Malta",
  tagline: "Tactical Laser Tag",
  description:
    "Outdoor tactical laser tag in Malta. Competitive missions, team battles, and live player stats.",

  // Update these as real details become available
  contact: {
    email: "info@laseropsmalta.com",
    phone: "",
    address: {
      street: "",
      locality: "Malta",
      country: "MT",
    },
  },

  social: {
    instagram: "",
    facebook: "",
    tiktok: "",
  },

  /** Public-facing site URL — fallback if env var not set */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://laseropsmalta.com",
} as const;
