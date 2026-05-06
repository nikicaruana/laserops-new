"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { primaryNav, ctaLinks, utilityNav } from "@/lib/nav";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";

/**
 * MobileNav.
 *
 * The hamburger trigger renders inline in the Header.
 *
 * The drawer panel is rendered via React Portal to document.body so it
 * escapes the Header's containing-block (which has backdrop-filter applied
 * and would otherwise scope `position: fixed` to itself, causing the panel
 * to mis-anchor when the page is scrolled).
 *
 * Panel uses semi-transparent bg + backdrop-blur for a frosted-glass look
 * over whatever content is behind it.
 *
 * Items with `children` are rendered as accordion buttons — tapping the
 * parent row toggles the sub-list inline; tapping a sub-link closes the
 * menu. Items without children navigate directly.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Portal target only exists after client mount; gate render with mounted flag
  // to avoid SSR/hydration mismatch.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Body scroll lock while open
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Escape key closes the panel
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    setOpenIndex(null);
  }

  // Build the flat mobile nav list: mobileExpand items are replaced by
  // their children (with the parent's color inherited).
  type MobileItem =
    | { kind: "link"; label: string; href: string; color: string }
    | { kind: "accordion"; link: (typeof primaryNav)[number]; index: number };

  const mobileItems: MobileItem[] = [];
  let accordionIndex = 0;
  for (const link of primaryNav) {
    if (link.hidden) continue;
    if (link.mobileExpand && link.children) {
      // Explode children as individual yellow links
      const color = link.highlight ? "#ffde00" : link.redHighlight ? "#b91c1c" : "#f5f5f5";
      for (const child of link.children) {
        mobileItems.push({ kind: "link", label: child.label, href: child.href, color });
      }
    } else {
      mobileItems.push({ kind: "accordion", link, index: accordionIndex });
      accordionIndex++;
    }
  }

  const panel = (
    <div
      id="mobile-nav-panel"
      role="dialog"
      aria-modal={open}
      aria-label="Site navigation"
      aria-hidden={!open}
      className="xl:!hidden"
      style={{
        display: open ? "flex" : "none",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 50,
        // Frosted-glass background: dark semi-transparent + backdrop blur
        backgroundColor: "rgba(10, 10, 10, 0.82)",
        backdropFilter: "blur(20px) saturate(140%)",
        WebkitBackdropFilter: "blur(20px) saturate(140%)",
        color: "#f5f5f5",
        flexDirection: "column",
        overflowY: "auto",
      }}
    >
      {/* Header strip inside the panel */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "72px",
          flexShrink: 0,
          padding: "0 1.25rem",
          borderBottom: "1px solid rgba(38, 38, 38, 0.6)",
        }}
      >
        <Logo variant="wordmark" color="yellow" size="sm" />
        <button
          type="button"
          aria-label="Close menu"
          onClick={close}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "40px",
            height: "40px",
            color: "#f5f5f5",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          <span style={{ position: "relative", display: "block", height: "14px", width: "24px" }}>
            <span
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: "50%",
                height: "1px",
                backgroundColor: "currentColor",
                transform: "rotate(45deg)",
              }}
            />
            <span
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: "50%",
                height: "1px",
                backgroundColor: "currentColor",
                transform: "rotate(-45deg)",
              }}
            />
          </span>
        </button>
      </div>

      {/* Primary nav */}
      <nav aria-label="Primary" style={{ padding: "1rem 1.25rem 0", flexShrink: 0 }}>
        {mobileItems.map((item, idx) => {
          if (item.kind === "link") {
            /* Flat link — used for mobileExpand children (e.g. Leaderboards,
               Player Stats, Match Report) — yellow color inherited from parent */
            return (
              <div
                key={item.href}
                style={{ borderBottom: "1px solid rgba(38, 38, 38, 0.6)" }}
              >
                <Link
                  href={item.href}
                  onClick={close}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "0.625rem 0",
                    fontSize: "1rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "-0.02em",
                    color: item.color,
                    textDecoration: "none",
                  }}
                >
                  {item.label}
                </Link>
              </div>
            );
          }

          /* Accordion item — parent link or plain link */
          const link = item.link;
          const i = item.index;
          const linkColor = link.highlight
            ? "#ffde00"
            : link.redHighlight
              ? "#b91c1c"
              : "#f5f5f5";

          return (
            <div
              key={link.href}
              style={{ borderBottom: "1px solid rgba(38, 38, 38, 0.6)" }}
            >
              {link.children ? (
                <>
                  <button
                    type="button"
                    onClick={() => setOpenIndex(openIndex === i ? null : i)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      padding: "0.625rem 0",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "1rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "-0.02em",
                      color: linkColor,
                      textDecoration: "none",
                    }}
                    aria-expanded={openIndex === i}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.625rem" }}>
                      {link.label}
                    </span>
                    <svg
                      aria-hidden
                      viewBox="0 0 10 6"
                      style={{
                        width: "10px",
                        height: "10px",
                        flexShrink: 0,
                        color: "#737373",
                        transform: openIndex === i ? "rotate(180deg)" : "none",
                        transition: "transform 200ms ease",
                      }}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="square"
                      strokeLinejoin="miter"
                    >
                      <path d="M1 1l4 4 4-4" />
                    </svg>
                  </button>
                  {openIndex === i && (
                    <div style={{ paddingBottom: "0.5rem" }}>
                      {link.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={close}
                          style={{
                            display: "block",
                            paddingTop: "0.5rem",
                            paddingBottom: "0.5rem",
                            paddingLeft: "1rem",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.14em",
                            color: "#a3a3a3",
                            textDecoration: "none",
                          }}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href={link.href}
                  onClick={close}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "0.625rem 0",
                    fontSize: "1rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "-0.02em",
                    color: linkColor,
                    textDecoration: "none",
                  }}
                >
                  {link.label}
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      {/* CTAs */}
      <div style={{ padding: "2rem 1.25rem 0", flexShrink: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <Button
            href={ctaLinks.primary.href}
            variant="primary"
            size="lg"
            onClick={close}
          >
            {ctaLinks.primary.label}
          </Button>
          <Button
            href={ctaLinks.secondary.href}
            variant="secondary"
            size="lg"
            onClick={close}
          >
            {ctaLinks.secondary.label}
          </Button>
        </div>
      </div>

      {/* Utility links */}
      <nav
        aria-label="Utility"
        style={{
          marginTop: "2rem",
          padding: "1.5rem 1.25rem",
          borderTop: "1px solid rgba(38, 38, 38, 0.6)",
          flexShrink: 0,
        }}
      >
        <ul
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem 1.5rem",
            listStyle: "none",
            padding: 0,
            margin: 0,
          }}
        >
          {utilityNav.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={close}
                style={{
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  color: "#737373",
                  textDecoration: "none",
                }}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );

  return (
    <>
      {/* Hamburger trigger — stays inline in header */}
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-10 w-10 items-center justify-center xl:hidden"
        style={{ color: "#f5f5f5" }}
      >
        <span style={{ position: "relative", display: "block", height: "14px", width: "24px" }}>
          <span
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: "1px",
              backgroundColor: "currentColor",
              transition: "all 300ms",
              top: open ? "50%" : 0,
              transform: open ? "rotate(45deg)" : "none",
            }}
          />
          <span
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: "1px",
              backgroundColor: "currentColor",
              transition: "all 300ms",
              bottom: open ? "50%" : 0,
              transform: open ? "rotate(-45deg)" : "none",
            }}
          />
        </span>
      </button>

      {/* Panel rendered via portal to escape header's containing block */}
      {mounted ? createPortal(panel, document.body) : null}
    </>
  );
}
