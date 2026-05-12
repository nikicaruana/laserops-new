import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { BookingForm } from "@/components/booking/BookingForm";

export const metadata: Metadata = {
  title: "Book a Laser Tag Session — LaserOps Malta",
  description:
    "Book your LaserOps Malta session online. €30 per person for a 3-hour outdoor laser tag session. Corporate events, birthday parties, and group bookings welcome.",
};

export default function BookingPage() {
  return (
    <>
      {/* ── Pricing header ───────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-16 sm:py-20">
          <span className="eyebrow">Book a Session</span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Book Your LaserOps Session
          </h1>
          <p className="mt-5 text-base leading-relaxed text-text-muted sm:text-lg">
            Fill in the form below and we&apos;ll get back to you within 24 hours to
            confirm availability and sort out the details.
          </p>

          {/* Pricing callout */}
          <div className="mt-8 border border-accent bg-bg-elevated px-6 py-5 sm:px-8">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-4xl font-extrabold tabular-nums text-accent sm:text-5xl">
                €30
              </span>
              <span className="text-sm font-semibold uppercase tracking-[0.1em] text-text-muted">
                per person · 3-hour session
              </span>
            </div>
            <ul className="mt-4 space-y-2">
              <li className="flex items-start gap-2 text-sm text-text-muted">
                <span className="mt-0.5 text-accent" aria-hidden>✓</span>
                The cheapest outdoor laser tag on the island
              </li>
              <li className="flex items-start gap-2 text-sm text-text-muted">
                <span className="mt-0.5 text-accent" aria-hidden>✓</span>
                The most recent laser tag equipment available in Malta
              </li>
            </ul>
          </div>
        </Container>
      </section>

      {/* ── Form ─────────────────────────────────────────────── */}
      <section className="border-b border-border bg-accent">
        <Container size="narrow" className="py-14 sm:py-16">
          <BookingForm onAccent />
        </Container>
      </section>
    </>
  );
}
