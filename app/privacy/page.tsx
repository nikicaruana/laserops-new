import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Privacy Policy",
  alternates: { canonical: "/privacy" },
  description:
    "How LaserOps Malta collects, uses, and protects your personal data. Your GDPR rights explained.",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-accent">
      {children}
    </span>
  );
}

export default function PrivacyPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-16 sm:py-20 lg:py-24">
          <span className="eyebrow">Legal</span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-5 text-base leading-relaxed text-text-muted sm:text-lg">
            This policy explains what personal data LaserOps Malta collects when
            you use this website, how we use it, and what rights you have under
            the General Data Protection Regulation (GDPR). LaserOps Malta is the
            data controller for all personal data processed through this site.
          </p>
        </Container>
      </section>

      {/* ── What We Collect ──────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Data We Collect</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Information We May Collect
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              <strong className="font-semibold text-text">Usage data.</strong>{" "}
              If you accept analytics cookies, Google Analytics 4 collects
              anonymised information about how you use the site — pages visited,
              time on page, general device type, and approximate location at
              country level. This data contains no personally identifiable
              information and is used solely to help us improve the site.
            </p>
            <p className="leading-relaxed">
              <strong className="font-semibold text-text">
                Enquiry and booking submissions.
              </strong>{" "}
              When you submit a contact or booking form, we collect the
              information you provide — typically your name, email address,
              phone number, and message. This is used only to respond to your
              enquiry.
            </p>
            <p className="leading-relaxed">
              We do not create user accounts, store payment details, or collect
              any sensitive personal data. Player stats on this site are linked
              to nicknames chosen in-game, not to any personal identity.
            </p>
          </div>
        </Container>
      </section>

      {/* ── How We Use It ────────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Purpose</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            How We Use Your Information
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              Analytics data (collected only with your consent) helps us
              understand which pages are most useful and how people find us, so
              we can improve the site experience. We do not sell this data or
              share it with third parties beyond Google Analytics.
            </p>
            <p className="leading-relaxed">
              Contact and booking form submissions are used solely to respond to
              your message and arrange your session. We do not add you to any
              mailing list or share your details with third parties.
            </p>
            <p className="leading-relaxed">
              If you consent to marketing cookies, Meta Pixel and Google Ads may
              be used to show you relevant LaserOps ads on Facebook, Instagram,
              and Google after your visit. You can withdraw this consent at any
              time via the Cookie Settings link in the footer.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Your Rights ──────────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>GDPR Rights</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Your Rights Under GDPR
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              As a resident of the EU or EEA, you have the right to access the
              personal data we hold about you, request that it be corrected or
              deleted, restrict or object to how we process it, and receive it
              in a portable format. You also have the right to withdraw consent
              at any time — this does not affect the lawfulness of processing
              carried out before withdrawal.
            </p>
            <p className="leading-relaxed">
              You can manage your cookie preferences at any time using the{" "}
              <strong className="font-semibold text-text">Cookie Settings</strong>{" "}
              link in the footer of every page. To exercise any other data
              rights, or to ask a question about how your data is used, contact
              us at the address below.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Contact ──────────────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Get In Touch</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Data Controller Contact
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              LaserOps Malta is the data controller for this website. For any
              privacy-related questions or to exercise your data rights, email us
              at{" "}
              <a
                href="mailto:info@laseropsmalta.com"
                className="text-accent hover:underline"
              >
                info@laseropsmalta.com
              </a>
              . We will respond within 30 days.
            </p>
            <p className="leading-relaxed">
              This policy may be updated from time to time. Any significant
              changes will be reflected here with a revised date. Continued use
              of the site after changes constitutes acceptance of the updated
              policy.
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
