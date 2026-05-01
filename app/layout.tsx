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
  // Site icons. Files live in /public/icons/. Next.js emits the right
  // <link> tags from this metadata — no need to write them manually.
  //
  //   - icon: browser tab favicons. Multiple sizes so browsers pick the
  //     best fit. The .ico is a fallback for older browsers and offline
  //     contexts (it's multi-resolution, containing 16/32/48 inside).
  //   - apple: shown when iOS users "Add to Home Screen". Pre-composited
  //     on the dark brand background so iOS doesn't put yellow art on
  //     a default white square.
  //   - shortcut: legacy Windows shortcut icon. Same as the .ico.
  icons: {
    icon: [
      { url: "/icons/favicon.ico", sizes: "any" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/icons/favicon.ico"],
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
