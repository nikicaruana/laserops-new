import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { MobileNav } from "@/components/layout/MobileNav";
import { primaryNav, ctaLinks } from "@/lib/nav";
import { cn } from "@/lib/cn";

export function Header() {
  return (
    <header
      className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-md supports-[backdrop-filter]:bg-bg/70"
      role="banner"
    >
      <Container size="wide">
        <div className="flex h-[72px] items-center justify-between gap-8">
          {/* Brand mark
              - <xl (mobile + tablet): full yellow wordmark, sm size
              - xl+ (desktop): smaller xs wordmark, fits beside nav */}
          <div className="xl:hidden">
            <Logo variant="wordmark" color="yellow" size="sm" />
          </div>
          <div className="hidden xl:block">
            <Logo variant="wordmark" color="yellow" size="xs" />
          </div>

          {/* Desktop nav — only shown xl+ */}
          <nav
            aria-label="Primary"
            className="hidden items-center gap-6 2xl:gap-8 xl:flex"
          >
            {primaryNav
              .filter((link) => !link.hidden)
              .map((link) =>
                link.children ? (
                  /* Items with dropdown children */
                  <div key={link.href} className="group relative">
                    <Link
                      href={link.href}
                      className={cn(
                        "inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
                        link.highlight && "text-accent hover:text-accent-soft",
                        link.redHighlight && "text-red-700 hover:text-red-600",
                        !link.highlight &&
                          !link.redHighlight &&
                          "text-text-muted hover:text-accent",
                      )}
                    >
                      {link.label}
                      {link.highlight && (
                        <span
                          aria-hidden
                          className="inline-block h-1 w-1 rounded-full bg-accent"
                        />
                      )}
                      {link.redHighlight && (
                        <span
                          aria-hidden
                          className="inline-block h-1 w-1 rounded-full bg-red-700"
                        />
                      )}
                      {/* Down chevron */}
                      <svg
                        aria-hidden
                        viewBox="0 0 10 6"
                        className="h-2 w-2 shrink-0 translate-y-px opacity-60"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="square"
                        strokeLinejoin="miter"
                      >
                        <path d="M1 1l4 4 4-4" />
                      </svg>
                    </Link>

                    {/* Dropdown panel — CSS-only via group-hover + group-focus-within */}
                    <div
                      className={cn(
                        "absolute left-0 top-full z-50 pt-2",
                        "pointer-events-none opacity-0 transition-opacity duration-150",
                        "group-hover:pointer-events-auto group-hover:opacity-100",
                        "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
                      )}
                    >
                      <div className="min-w-[168px] rounded-sm border border-border bg-bg py-1 shadow-lg">
                        {link.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className="block px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted transition-colors hover:text-accent"
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Plain links — no dropdown */
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "relative text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
                      link.highlight && "text-accent hover:text-accent-soft",
                      link.redHighlight && "text-red-700 hover:text-red-600",
                      !link.highlight &&
                        !link.redHighlight &&
                        "text-text-muted hover:text-accent",
                    )}
                  >
                    {link.label}
                    {link.redHighlight && (
                      <span
                        aria-hidden
                        className="ml-1.5 inline-block h-1 w-1 -translate-y-[2px] rounded-full bg-red-700 align-middle"
                      />
                    )}
                  </Link>
                ),
              )}
          </nav>

          {/* Desktop CTA — only shown xl+ */}
          <div className="hidden xl:block">
            <Button href={ctaLinks.primary.href} variant="primary" size="md">
              {ctaLinks.primary.label}
            </Button>
          </div>

          {/* Mobile/tablet nav (renders its own trigger + panel) */}
          <MobileNav />
        </div>
      </Container>
    </header>
  );
}
