"use client";

/**
 * components/admin/LifecycleGroup.tsx
 * --------------------------------------------------------------------
 * A lifecycle phase grouping on the match detail page (e.g. "Booking & pre-game",
 * "Live game", "After the game"). It's a bordered block whose header toggles the
 * whole group open/closed. Collapsed by default so a freshly-opened match reads
 * clean; the group matching the game's current status is highlighted ("Current
 * stage") and pulled to the top via CSS `order`, while staying collapsed until
 * the admin opens it. Inner sections (CollapsibleSection, editors) are the children.
 */
import { useState, type ReactNode } from "react";

export function LifecycleGroup({
  title,
  hint,
  active = false,
  order,
  defaultOpen = false,
  children,
}: {
  title: string;
  /** Short muted summary of what's inside, shown on the right of the header. */
  hint?: string;
  /** True when this is the game's current lifecycle stage (highlighted + lifted). */
  active?: boolean;
  /** CSS flex order within the groups column (lets us lift the active stage). */
  order?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      style={order != null ? { order } : undefined}
      className={`border ${active ? "border-accent/60 bg-accent/[0.04]" : "border-border bg-bg-elevated/20"}`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className={`shrink-0 transition-transform ${open ? "rotate-90" : ""} ${active ? "text-accent" : "text-text-muted"}`} aria-hidden>
          ▸
        </span>
        <h2 className={`text-sm font-bold uppercase tracking-[0.12em] ${active ? "text-accent" : "text-text"}`}>{title}</h2>
        {active && (
          <span className="shrink-0 border border-accent/60 bg-accent/10 px-2 py-0.5 text-[0.5rem] font-bold uppercase tracking-[0.14em] text-accent">
            Current stage
          </span>
        )}
        {hint && <span className="ml-auto hidden text-[0.65rem] text-text-subtle sm:block">{hint}</span>}
      </button>
      {open && <div className="space-y-6 border-t border-border px-4 py-5">{children}</div>}
    </section>
  );
}
