import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { primaryNav, utilityNav } from "@/lib/nav";
import { brand } from "@/lib/brand";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-bg-elevated" role="contentinfo">
      <Container size="wide" className="py-16">
        <div className="grid gap-12 md:grid-cols-12">
          {/* Brand column — full wordmark gets room to breathe here */}
          <div className="md:col-span-5">
            <Logo variant="wordmark" color="white" size="md" />
            <p className="mt-6 max-w-md text-sm leading-relaxed text-text-muted">
              {brand.description}
            </p>
          </div>

          {/* Sitemap column */}
          <nav aria-label="Footer navigation" className="md:col-span-4 md:col-start-7">
            <h2 className="eyebrow mb-5">Explore</h2>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-3">
              {primaryNav.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-muted transition-colors hover:text-accent"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Utility column */}
          <div className="md:col-span-3">
            <h2 className="eyebrow mb-5">Contact</h2>
            <ul className="space-y-3 text-sm text-text-muted">
              <li>
                <a
                  href={`mailto:${brand.contact.email}`}
                  className="transition-colors hover:text-accent"
                >
                  {brand.contact.email}
                </a>
              </li>
              <li>{brand.contact.address.locality}</li>
            </ul>
          </div>
        </div>

        {/* Bottom strip */}
        <div className="mt-16 flex flex-col gap-4 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-text-subtle">
            © {year} {brand.fullName}. All rights reserved.
          </p>
          <ul className="flex gap-6">
            {utilityNav.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-xs uppercase tracking-[0.14em] text-text-subtle transition-colors hover:text-accent"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  );
}
