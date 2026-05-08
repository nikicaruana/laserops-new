import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { FaqSearch } from "@/components/faqs/FaqSearch";

export const metadata: Metadata = {
  title: "FAQs | LaserOps Malta",
  description:
    "Answers to the most common questions about laser tag at LaserOps Malta — costs, group sizes, what to wear, stats, photography, catering, and how to book.",
};

export default function FaqsPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-16 sm:py-20 lg:py-24">
          <span className="eyebrow">FAQs</span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Frequently Asked Questions
          </h1>
          <p className="mt-5 text-base leading-relaxed text-text-muted sm:text-lg">
            Everything you need to know before you show up. Can&apos;t find what
            you&apos;re looking for? Get in touch and we&apos;ll sort it.
          </p>
        </Container>
      </section>

      {/* ── FAQ list with search ──────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-14 sm:py-16">
          <FaqSearch />
        </Container>
      </section>
    </>
  );
}
