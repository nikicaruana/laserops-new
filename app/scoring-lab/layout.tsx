import { notFound } from "next/navigation";
import type { ReactNode } from "react";

/**
 * app/scoring-lab/layout.tsx
 * --------------------------------------------------------------------
 * Dev-only route guard. /scoring-lab is a localhost scoring experiment (baked-in
 * aggregates, not linked in nav). This makes the whole route 404 in production
 * builds so it never ships live, while staying available in development.
 */
export const metadata = { robots: { index: false, follow: false } };

export default function ScoringLabLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <>{children}</>;
}
