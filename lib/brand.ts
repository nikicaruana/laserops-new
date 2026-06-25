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
    phone: "+356 9999 1053",
    address: {
      street: "",
      locality: "Malta",
      country: "MT",
    },
  },

  social: {
    instagram: "https://www.instagram.com/laserops.mt/",
    facebook: "https://www.facebook.com/laserops.mt",
    tiktok: "",
    /** WhatsApp community group invite link — set NEXT_PUBLIC_WHATSAPP_URL in Vercel */
    whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_URL ?? "",
  },

  /** Public-facing site URL — fallback if env var not set */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://www.laseropsmalta.com",
} as const;
