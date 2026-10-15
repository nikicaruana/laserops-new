"use client";

/**
 * components/layout/ChromeGate.tsx
 * --------------------------------------------------------------------
 * Hides the marketing site chrome (header, footer, cookie banner) on the
 * /admin area so it renders as a clean full-screen tool, and on standalone
 * landing pages (e.g. the Welbee's QR offer) that bring their own banner and
 * footer. usePathname is resolved during SSR too, so the chrome is never in
 * that HTML at all.
 */
import { usePathname } from "next/navigation";

export function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin") || pathname === "/welbees-offer") return null;
  return <>{children}</>;
}
