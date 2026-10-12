import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Payment & Cancellation Policy",
  alternates: { canonical: "/refund-policy" },
  description:
    "How LaserOps Malta handles payment and cancellations: you pay after you play (game token, Revolut or cash), cancelling is free, and how game tokens work.",
};

export const revalidate = 3600;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-accent">
      {children}
    </span>
  );
}

export default async function RefundPolicyPage() {
  const sections: { label: string; heading: string; items: React.ReactNode[] }[] = [
    {
      label: "Booking & payment",
      heading: "Booking and payment",
      items: [
        "Games are booked through this website, and there is no payment when you sign up, so holding a place costs you nothing up front.",
        "You pay after you play. Once your game is over you settle up from your account: use a game token, pay by Revolut, or pay cash on the day.",
        "Prices and the session length are set by LaserOps and shown before you play. Private and company bookings may be arranged and priced separately, and we confirm the details with you first.",
      ],
    },
    {
      label: "Cancelling",
      heading: "Cancelling your place",
      items: [
        "Because nothing is charged when you book, you can cancel your place any time before the game at no cost, and there is nothing to refund.",
        "If you cannot make it, please cancel from your game screen as early as you can so your spot frees up for someone else.",
        "You can also pass your place to another player instead of cancelling.",
        "Missed games (no-shows) may still be charged at our discretion, since the spot was held for you.",
      ],
    },
    {
      label: "Refunds",
      heading: "Refunds",
      items: [
        "Because payment happens after the game, there is usually nothing to refund.",
        "If you ever pay us for a game that does not go ahead, we return exactly what you paid, in the same mix: any game token goes back to your wallet, and any cash or Revolut amount is returned to you.",
      ],
    },
    {
      label: "Cancelled or shortened games",
      heading: "If we cancel or cut a game short",
      items: [
        "If we cancel a game, you owe nothing, as nothing was charged.",
        "If a game is cut short, for example due to weather, we may reduce what you owe, or credit a portion of a game token back to your wallet (typically 25%, 50% or 75%), at our discretion.",
      ],
    },
    {
      label: "Game tokens",
      heading: "Game tokens",
      items: [
        "Game tokens are prepaid game credits, where one token books one game. You can request a bundle from the store and we arrange payment with you; tokens are credited to your account once that payment is settled.",
        "Tokens bought in a bundle are valid for the period shown on that bundle and expire after it. Expired tokens cannot be used or refunded.",
      ],
    },
    {
      label: "Conduct",
      heading: "Safety and conduct",
      items: [
        "We may stop a game or remove anyone who behaves unsafely or breaks our rules.",
        "Cheating, tampering with equipment, or abusing game mechanics may void your scores and rewards and forfeit your place.",
      ],
    },
    {
      label: "Requesting a token credit",
      heading: "How to cancel or ask about a token credit",
      items: [
        <>
          You can cancel your place from your game screen in the{" "}
          <Link href="/player-portal/games" className="text-accent hover:underline">player portal</Link>, any time before
          the game.
        </>,
        <>
          For a token credit after a cancelled or shortened game, or any question about payment, please{" "}
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
            Payment &amp; Cancellation Policy
          </h1>
          <p className="mt-5 text-base leading-relaxed text-text-muted sm:text-lg">
            This policy explains how LaserOps Malta handles payment and cancellations for games booked through this
            website. You pay after you play, so cancelling is free and refunds are rare. It forms part of our{" "}
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
