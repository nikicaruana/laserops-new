"use client";

/**
 * components/admin/AdminNav.tsx
 * --------------------------------------------------------------------
 * Admin navigation. Desktop (lg+): a fixed sidebar. Mobile: a top bar with a
 * hamburger that opens a full-screen frosted drawer (same feel as the site's
 * MobileNav). Sections not built yet show a "soon" tag; the active link is the
 * longest href the pathname matches, so a child route highlights its own item.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type Item = { label: string; href?: string };

const SECTIONS: { heading: string; items: Item[] }[] = [
  {
    heading: "Overview",
    items: [
      { label: "Dashboard", href: "/admin" },
      { label: "Change log", href: "/admin/changelog" },
      { label: "User management", href: "/admin/users" },
    ],
  },
  {
    heading: "Arsenal",
    items: [
      { label: "Guns", href: "/admin/guns" },
      { label: "Classes & Trees", href: "/admin/guns/taxonomy" },
    ],
  },
  {
    heading: "Progression",
    items: [
      { label: "XP & Levels" },
      { label: "ELO" },
      { label: "Ratings" },
      { label: "Scoring formula", href: "/admin/scoring" },
      { label: "Accolades", href: "/admin/accolades" },
      { label: "Streaks" },
    ],
  },
  {
    heading: "Seasons",
    items: [
      { label: "Seasons", href: "/admin/seasons" },
      { label: "Challenges", href: "/admin/challenges" },
    ],
  },
  {
    heading: "Integrity",
    items: [{ label: "Exploit control", href: "/admin/exploit-control" }],
  },
  {
    heading: "Other",
    items: [
      { label: "Teams", href: "/admin/teams" },
      { label: "Excluded players", href: "/admin/excluded-players" },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll + close on Escape while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const matches = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(href + "/");
  const activeHref = SECTIONS.flatMap((s) => s.items.map((i) => i.href))
    .filter((h): h is string => Boolean(h) && matches(h!))
    .sort((a, b) => b.length - a.length)[0];

  const sections = (onNavigate?: () => void) => (
    <div className="flex flex-col gap-6">
      {SECTIONS.map((section) => (
        <div key={section.heading}>
          <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-text-muted">
            {section.heading}
          </p>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = item.href && item.href === activeHref;
              return (
                <li key={item.label}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center justify-between border-l-2 px-3 py-1.5 text-sm transition-colors",
                        active
                          ? "border-accent bg-bg-elevated font-semibold text-accent"
                          : "border-transparent text-text hover:border-accent hover:text-accent",
                      )}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span className="flex items-center justify-between border-l-2 border-transparent px-3 py-1.5 text-sm text-text-muted">
                      {item.label}
                      <span className="text-[0.55rem] font-bold uppercase tracking-[0.14em] text-text-subtle">
                        soon
                      </span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );

  const exitLink = (
    <Link
      href="/"
      className="mt-8 block text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-text-muted hover:text-accent"
    >
      ← Exit admin
    </Link>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="mb-2 flex items-center justify-between lg:hidden">
        <Link href="/admin" className="text-sm font-extrabold uppercase tracking-[0.18em] text-accent">
          Admin
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="inline-flex h-10 w-10 items-center justify-center text-text"
        >
          <span className="relative block h-[14px] w-6">
            <span className="absolute left-0 right-0 top-0 h-px bg-current" />
            <span className="absolute bottom-0 left-0 right-0 h-px bg-current" />
          </span>
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg/95 backdrop-blur-md lg:hidden">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
            <span className="text-sm font-extrabold uppercase tracking-[0.18em] text-accent">
              Admin
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="inline-flex h-10 w-10 items-center justify-center text-text"
            >
              <span className="relative block h-[14px] w-6">
                <span className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 rotate-45 bg-current" />
                <span className="absolute bottom-1/2 left-0 right-0 h-px translate-y-1/2 -rotate-45 bg-current" />
              </span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-6">
            {sections(() => setOpen(false))}
            {exitLink}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <nav className="hidden lg:block lg:w-56 lg:shrink-0">
        <Link
          href="/admin"
          className="mb-8 block text-sm font-extrabold uppercase tracking-[0.18em] text-accent"
        >
          Admin
        </Link>
        {sections()}
        {exitLink}
      </nav>
    </>
  );
}
