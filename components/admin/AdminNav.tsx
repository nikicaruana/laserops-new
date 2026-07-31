"use client";

/**
 * components/admin/AdminNav.tsx
 * --------------------------------------------------------------------
 * Sidebar navigation for the admin area. Lists the config sections; ones
 * not built yet are shown disabled with a "soon" tag so the roadmap is
 * visible. The active link is the LONGEST href the pathname matches, so a
 * child route (e.g. /admin/guns/taxonomy) highlights its own item rather
 * than the parent (/admin/guns).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

type Item = { label: string; href?: string };

const SECTIONS: { heading: string; items: Item[] }[] = [
  {
    heading: "Overview",
    items: [{ label: "Dashboard", href: "/admin" }],
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
      { label: "Scoring formula" },
      { label: "Accolades" },
      { label: "Streaks" },
    ],
  },
  {
    heading: "Seasons",
    items: [{ label: "Seasons" }, { label: "Challenges" }],
  },
  {
    heading: "Other",
    items: [{ label: "Teams" }, { label: "Excluded players" }],
  },
];

export function AdminNav() {
  const pathname = usePathname();

  // Match an href against the current path, then pick the longest match so the
  // most specific route wins (taxonomy beats guns on /admin/guns/taxonomy).
  const matches = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(href + "/");
  const activeHref = SECTIONS.flatMap((s) => s.items.map((i) => i.href))
    .filter((h): h is string => Boolean(h) && matches(h!))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav className="lg:w-56 lg:shrink-0">
      <div className="mb-6 flex items-center justify-between lg:mb-8">
        <Link
          href="/admin"
          className="text-sm font-extrabold uppercase tracking-[0.18em] text-accent"
        >
          Admin
        </Link>
        <Link
          href="/"
          className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-text-muted hover:text-accent lg:hidden"
        >
          Exit
        </Link>
      </div>

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

      <Link
        href="/"
        className="mt-8 hidden text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-text-muted hover:text-accent lg:block"
      >
        ← Exit admin
      </Link>
    </nav>
  );
}
