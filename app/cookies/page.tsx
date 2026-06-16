import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Cookie Policy",
  alternates: { canonical: "/cookies" },
  description:
    "What cookies LaserOps Malta uses, why, and how to manage your preferences at any time.",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-accent">
      {children}
    </span>
  );
}

export default function CookiesPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-16 sm:py-20 lg:py-24">
          <span className="eyebrow">Legal</span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Cookie Policy
          </h1>
          <p className="mt-5 text-base leading-relaxed text-text-muted sm:text-lg">
            Cookies are small text files stored on your device when you visit a
            website. This page explains which cookies this site uses, what they
            do, and how you can control them. You are always in control — you
            can update your preferences at any time using the Cookie Settings
            link in the footer.
          </p>
        </Container>
      </section>

      {/* ── Necessary ────────────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Always Active</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Strictly Necessary Cookies
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              These cookies are required for the site to function correctly.
              They include cookies that remember your consent preferences so you
              are not asked again on every page visit. They do not collect
              personal information and are never shared with third parties.
            </p>
            <p className="leading-relaxed">
              Because these cookies are essential, they are always active and
              cannot be disabled through the consent banner.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Analytics ────────────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Optional</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Analytics Cookies
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              <strong className="font-semibold text-text">Google Analytics 4</strong>{" "}
              uses cookies to collect anonymised information about how visitors
              use this site — which pages are visited, how long sessions last,
              what type of device is used, and the general geographic region of
              visitors. No personally identifiable information is collected.
            </p>
            <p className="leading-relaxed">
              This data helps us understand what content is most useful and how
              people find the site, so we can improve it over time. Analytics
              cookies are only set if you grant analytics consent via the cookie
              banner or Cookie Settings.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Marketing ────────────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Optional</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Marketing Cookies
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              <strong className="font-semibold text-text">Meta Pixel</strong> and{" "}
              <strong className="font-semibold text-text">Google Ads</strong> use
              cookies to recognise visitors who have been to this site and show
              them relevant LaserOps ads on Facebook, Instagram, and Google
              search and display networks. This helps us reach people who have
              already shown an interest in booking a session.
            </p>
            <p className="leading-relaxed">
              Marketing cookies are only set if you grant marketing consent via
              the cookie banner or Cookie Settings. If you decline, no
              advertising data is collected and you will not be targeted with
              ads based on your visit to this site.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Managing Preferences ─────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Your Control</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            How to Manage Your Cookie Preferences
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              When you first visit this site, a cookie banner will appear giving
              you the choice to accept all cookies, decline all optional cookies,
              or manage your preferences individually for analytics and
              marketing. Your choice is saved so you are not asked again on
              future visits.
            </p>
            <p className="leading-relaxed">
              You can revisit and change your preferences at any time using the{" "}
              <strong className="font-semibold text-text">Cookie Settings</strong>{" "}
              link in the footer of every page. You can also control cookies
              through your browser settings — most browsers allow you to block
              or delete cookies entirely, though this may affect how some sites
              function.
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
