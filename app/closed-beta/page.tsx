import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

/**
 * app/closed-beta/page.tsx
 * --------------------------------------------------------------------
 * Landing page for the closed-group staging gate. Shown to anyone whose email
 * is not on the staging allowlist (see lib/staging-gate + middleware). In
 * production this page is simply never linked to.
 */
export const metadata: Metadata = {
  title: "Private Beta",
  robots: { index: false, follow: false },
};

export default function ClosedBetaPage() {
  return (
    <section className="flex min-h-[70vh] items-center">
      <Container size="narrow" className="py-20 text-center">
        <span className="eyebrow">LaserOps</span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-text sm:text-4xl">
          Private beta
        </h1>
        <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-text-muted">
          This is a closed preview of the new LaserOps site, open to an invited group while we test
          things before launch. If you were invited, sign in with the email you were invited with to
          get access.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button href="/player-portal/login" variant="primary" size="lg">
            Sign in
          </Button>
          <Button href="https://laseropsmalta.com" variant="secondary" size="lg">
            Visit the live site
          </Button>
        </div>
        <p className="mx-auto mt-8 max-w-sm text-xs text-text-subtle">
          Signed in but still seeing this? Your account is not on the beta list yet. Reach out to the
          LaserOps team to be added.
        </p>
      </Container>
    </section>
  );
}
