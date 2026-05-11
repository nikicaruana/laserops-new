import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Who We Are | LaserOps Malta | Outdoor Laser Tag",
  description:
    "LaserOps was started in 2025 by two friends who've played laser tag for over two decades. Building a community of regular players in Malta who take the sport seriously.",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-accent">
      {children}
    </span>
  );
}

export default function WhoWeArePage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-16 sm:py-20 lg:py-24">
          <span className="eyebrow">About</span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Who We Are
          </h1>
          <p className="mt-5 text-base leading-relaxed text-text-muted sm:text-lg">
            LaserOps was started by Kyle in 2025, with his close friend Niki
            coming on board some time later. Between the two of them, they&apos;ve
            been playing laser tag for over two decades, and they&apos;ve spent most
            of that time wishing laser tag was more than just a one-off session
            every month or so.
          </p>
        </Container>
      </section>

      {/* ── Taking Laser Tag To The Next Level ───────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Our Mission</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Taking Laser Tag To The Next Level
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              LaserOps aims to bridge the gap between laser tag, competitive
              sports, and online first-person shooters, and in doing so build a{" "}
              <a href="/community" className="text-accent hover:underline">
                community
              </a>{" "}
              of regular players who share the same passion for laser tag as we
              do. By building this platform — allowing players to track their
              performance over time, unlock new loadouts, and compete in
              seasonal challenges — we want to give our player base a reason to
              keep coming back, aside from the fact that playing with us is
              great fun.
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
