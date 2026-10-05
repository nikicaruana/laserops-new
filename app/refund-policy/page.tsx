import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { getRefundConfig } from "@/lib/payments/refund-config";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  alternates: { canonical: "/refund-policy" },
  description:
    "How LaserOps Malta handles cancellations and refunds: the refund window, how refunds are paid, cancelled or shortened games, and game tokens.",
};

// ISR: tracks the admin-set refund window without a redeploy.
export const revalidate = 3600;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-accent">
      {children}
    </span>
  );
}

export default async function RefundPolicyPage() {
  // Live window (falls back to the policy.ts defaults), so this page always
  // matches what the system actually enforces.
  const { autoRefundHours, noRefundHours } = await getRefundConfig();

  const sections: { label: string; heading: string; items: React.ReactNode[] }[] = [
    {
      label: "Booking & payment",
      heading: "Booking and payment",
      items: [
        "Games are booked through this website. Paying online confirms your place in a game once the game is confirmed.",
        "Prices and the session length are shown at checkout before you pay, and are set by LaserOps. Private and company bookings may be arranged and priced separately, and we confirm the details with you first.",
      ],
    },
    {
      label: "Cancelling",
      heading: "Cancelling your place",
      items: [
        `Cancel ${autoRefundHours} hours or more before the game and you receive an automatic full refund.`,
        `Cancel between ${noRefundHours} and ${autoRefundHours} hours before the game and refunds are by request, granted at our discretion.`,
        `Within ${noRefundHours} hours of the game, payments are non-refundable.`,
        "You can pass your place to another player at any time instead of cancelling.",
        "Missed games (no-shows) are not refundable.",
      ],
    },
    {
      label: "How refunds are paid",
      heading: "How refunds are paid",
      items: [
        "We refund exactly what you paid, in the same mix. Card payments are returned to your original payment method, and any game tokens are returned to your wallet.",
        "Where you paid with both a card and tokens, the card portion is refunded first, then the tokens.",
        "Card refunds are issued through our payment provider and can take a few business days to appear, depending on your bank.",
      ],
    },
    {
      label: "Cancelled or shortened games",
      heading: "If we cancel or cut a game short",
      items: [
        "If we cancel a game, everyone who paid is refunded in full, automatically.",
        "If a game is cut short, for example due to weather, we may refund everyone a portion of the price (typically 25%, 50% or 75%), at our discretion.",
      ],
    },
    {
      label: "Game tokens",
      heading: "Game tokens",
      items: [
        "Game tokens are credited to your account once your payment is confirmed. One token books one game.",
        "Tokens bought in a bundle are valid for the period shown on that bundle and expire after it. Expired tokens cannot be used or refunded.",
      ],
    },
    {
      label: "Conduct",
      heading: "Safety and conduct",
      items: [
        "We may stop a game or remove anyone who behaves unsafely or breaks our rules, without a refund.",
        "Cheating, tampering with equipment, or abusing game mechanics may void your scores and rewards and forfeit your place, with no refund.",
      ],
    },
    {
      label: "Requesting a refund",
      heading: "How to cancel or request a refund",
      items: [
        <>
          You can cancel your place from your game screen in the{" "}
          <Link href="/player-portal/games" className="text-accent hover:underline">player portal</Link>. Cancellations
          inside the automatic window are refunded with no further action needed.
        </>,
        <>
          For a by-request refund, or any question about a refund, please{" "}
          <Link href="/contact" className="text-accent hover:underline">contact us</Link> and we will help.
        </>,
      ],
    },
  ];

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-16 sm:py-20 lg:py-24">
          <span className="eyebrow">Legal</span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Refund &amp; Cancellation Policy
          </h1>
          <p className="mt-5 text-base leading-relaxed text-text-muted sm:text-lg">
            This policy explains how LaserOps Malta handles cancellations and refunds for games booked and
            paid for through this website. It forms part of our{" "}
            <Link href="/terms" className="text-accent hover:underline">Terms &amp; Conditions</Link>.
          </p>
        </Container>
      </section>

      {sections.map((s, i) => (
        <section key={s.heading} className={`border-b border-border ${i % 2 === 1 ? "portal-surface" : ""}`}>
          <Container size="narrow" className="py-14 sm:py-16">
            <SectionLabel>{s.label}</SectionLabel>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">{s.heading}</h2>
            <ul className="mt-6 space-y-4">
              {s.items.map((item, j) => (
                <li key={j} className="flex gap-3 text-base leading-relaxed text-text-muted">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ))}
    </>
  );
}
