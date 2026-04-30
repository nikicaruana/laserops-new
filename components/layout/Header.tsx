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
              - <lg (mobile + tablet): full yellow wordmark, sm size
              - lg+ (desktop): smaller xs wordmark, fits beside nav */}
          <div className="lg:hidden">
            <Logo variant="wordmark" color="yellow" size="sm" />
          </div>
          <div className="hidden lg:block">
            <Logo variant="wordmark" color="yellow" size="xs" />
          </div>

          {/* Desktop nav — only shown lg+ */}
          <nav
            aria-label="Primary"
            className="hidden items-center gap-6 xl:gap-8 lg:flex"
          >
            {primaryNav.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
                  link.highlight
                    ? "text-accent hover:text-accent-soft"
                    : "text-text-muted hover:text-accent",
                )}
              >
                {link.label}
                {link.highlight && (
                  <span
                    aria-hidden
                    className="ml-1.5 inline-block h-1 w-1 -translate-y-[2px] rounded-full bg-accent align-middle"
                  />
                )}
              </Link>
            ))}
          </nav>

          {/* Desktop CTA — only shown lg+ */}
          <div className="hidden lg:block">
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
