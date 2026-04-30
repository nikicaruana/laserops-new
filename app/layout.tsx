import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { GTM, GTMNoScript } from "@/components/tracking/GTM";
import { brand } from "@/lib/brand";

// Self-hosted via next/font — no external CDN call, GDPR-friendly
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(brand.siteUrl),
  title: {
    default: `${brand.fullName} — ${brand.tagline}`,
    template: `%s | ${brand.fullName}`,
  },
  description: brand.description,
  applicationName: brand.fullName,
  keywords: [
    "laser tag malta",
    "outdoor laser tag malta",
    "tactical laser tag",
    "competitive laser tag",
    "team building malta",
    "things to do in malta",
    "group activities malta",
  ],
  authors: [{ name: brand.fullName }],
  creator: brand.fullName,
  publisher: brand.fullName,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_MT",
    siteName: brand.fullName,
    title: `${brand.fullName} — ${brand.tagline}`,
    description: brand.description,
    url: brand.siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: `${brand.fullName} — ${brand.tagline}`,
    description: brand.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={montserrat.variable}>
      <head>
        <GTM />
      </head>
      <body className="flex min-h-dvh flex-col bg-bg text-text antialiased">
        <GTMNoScript />
        {/* Skip link for keyboard / screen reader users */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-accent focus:px-4 focus:py-2 focus:text-bg"
        >
          Skip to content
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
