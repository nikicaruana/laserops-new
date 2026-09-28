"use client";

/**
 * components/admin/CollapsibleSection.tsx
 * --------------------------------------------------------------------
 * A titled section on the match detail page that collapses/expands. The heading
 * doubles as the toggle; server-rendered content is passed straight through as
 * children (a client wrapper can render server children via the children prop).
 */
import { useState, type ReactNode } from "react";

export function CollapsibleSection({
  title,
  count,
  subtitle,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: number;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mb-8">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 border-b border-border pb-2 text-left"
        aria-expanded={open}
      >
        <span className={`text-text-muted transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>
          ▸
        </span>
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-accent">
          {title}
          {count != null && <span className="ml-1.5 text-text-muted">({count})</span>}
        </h2>
      </button>
      {open && (
        <div className="pt-4">
          {subtitle && <p className="mb-3 -mt-1 text-xs text-text-muted">{subtitle}</p>}
          {children}
        </div>
      )}
    </section>
  );
}
