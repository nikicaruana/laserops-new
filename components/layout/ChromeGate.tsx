"use client";

/**
 * components/layout/ChromeGate.tsx
 * --------------------------------------------------------------------
 * Hides the marketing site chrome (header, footer, cookie banner) on the
 * /admin area so it renders as a clean full-screen tool, and on standalone
 * landing pages (e.g. the Welbee's QR offer) that bring their own banner and
 * footer. usePathname is resolved during SSR too, so the chrome is never in
 * that HTML at all.
 *
 * `adminOnly` hides only on /admin: used for the cookie banner, which landing
 * pages still need so EEA visitors can opt in to analytics.
 */
import { usePathname } from "next/navigation";

export function ChromeGate({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  if (!adminOnly && pathname === "/welbees-offer") return null;
  return <>{children}</>;
}
