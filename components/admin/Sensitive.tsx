import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/**
 * components/admin/Sensitive.tsx
 * --------------------------------------------------------------------
 * Marks a value as sensitive (customer PII, financial figures) so Demo Mode can
 * blur it on screen. Server-safe (no client hooks): the blur is pure CSS, driven
 * by the `data-demo="on"` attribute on <html> that DemoModeToggle sets. The real
 * value is still rendered; it is only visually masked, and only while an admin
 * has Demo Mode on in their own browser. Use it around emails, phone numbers,
 * full legal names and money figures shown in the admin.
 */
export function Sensitive({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("demo-sensitive", className)}>{children}</span>;
}
