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
            {primaryNav.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
                  // Three tone variants. redHighlight uses red-800 — same
                  // muted red as the Match Report XP card's progress bar
                  // and ▶ marker, so the nav and the feature read as
                  // visually related.
                  link.highlight && "text-accent hover:text-accent-soft",
                  link.redHighlight && "text-red-700 hover:text-red-600",
                  !link.highlight && !link.redHighlight && "text-text-muted hover:text-accent",
                )}
              >
                {link.label}
                {link.highlight && (
                  <span
                    aria-hidden
                    className="ml-1.5 inline-block h-1 w-1 -translate-y-[2px] rounded-full bg-accent align-middle"
                  />
                )}
                {link.redHighlight && (
                  <span
                    aria-hidden
                    className="ml-1.5 inline-block h-1 w-1 -translate-y-[2px] rounded-full bg-red-700 align-middle"
                  />
                )}
              </Link>
            ))}
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
