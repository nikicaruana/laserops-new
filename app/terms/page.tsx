import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  alternates: { canonical: "/terms" },
  description:
    "The terms that govern your LaserOps Malta account, bookings, payments, refunds, gameplay, and how rewards are issued and may be revoked.",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-accent">{children}</span>;
}

type Section = { label: string; heading: string; intro?: string; items: string[] };

const SECTIONS: Section[] = [
  {
    label: "Your account",
    heading: "Account & eligibility",
    items: [
      "You must give accurate details when you create an account and keep them up to date.",
      "Keep one account per person and keep your login secure. You are responsible for activity that happens on your account.",
      "If you are under 18, you must have permission from a parent or guardian, who accepts these terms on your behalf. Some games and events may have their own age or supervision requirements.",
      "We may suspend or close an account that breaches these terms or our game rules.",
    ],
  },
  {
    label: "Bookings",
    heading: "Bookings & payments",
    items: [
      "Games are booked through this site and are subject to availability, our opening hours, and a break we enforce between bookings.",
      "For open games, paying online confirms your place once the game is confirmed. Prices are shown at checkout; the normal price and session length are set by us and may change.",
      "Private and company bookings may be arranged and priced separately, and we will confirm the details with you.",
      "You are responsible for arriving on time. Missed games (no-shows) are not refundable.",
    ],
  },
  {
    label: "Refunds",
    heading: "Refunds & cancellations",
    items: [
      "Paying online confirms your place in a game.",
      "If you cancel your place: 48 hours or more before the game, you receive an automatic full refund. Between 48 and 24 hours before, refunds are by request and granted at our discretion. Within 24 hours of the game, payments are non-refundable. You can pass your place to another player at any time instead.",
      "We refund exactly what you paid, in the same mix. Cash payments are returned to your original payment method and any game tokens are returned to your wallet. Where you paid with both, the cash portion is refunded first, then tokens.",
      "If we cancel a game, everyone who paid is refunded in full.",
      "If a game is cut short (for example, due to weather), we may refund everyone a portion of the price at our discretion.",
      "Expired tokens cannot be used or refunded.",
    ],
  },
  {
    label: "Safety",
    heading: "Health, safety & assumption of risk",
    items: [
      "Laser tag at LaserOps is a physical activity played outdoors on uneven terrain. You take part at your own risk.",
      "You confirm you are physically fit to take part and have no medical condition that makes participation unsafe. If you are unsure, seek medical advice first, and tell a marshal of anything we should know about.",
      "You must follow the safety briefing, all signage, and marshal instructions at all times. Wear suitable clothing and footwear and play at a sensible pace.",
      "We may stop a game or remove anyone who behaves unsafely, without a refund.",
      "To the fullest extent permitted by law, LaserOps is not liable for injury, loss, or damage arising from your participation, except where caused by our negligence. Nothing in these terms limits any liability that cannot be excluded under Maltese law.",
    ],
  },
  {
    label: "Fair play",
    heading: "Conduct & fair play",
    items: [
      "Respect other players, our staff, and the equipment. No aggression, dangerous play, or deliberate physical contact.",
      "No cheating, exploiting, tampering with equipment, or abusing game mechanics. Doing so may void your scores and rewards and forfeit your place, with no refund.",
      "You are responsible for the equipment issued to you during a game. Report any fault to a marshal.",
      "We may remove you from a game or the venue for misconduct, with no refund.",
    ],
  },
  {
    label: "Rewards & Loyalty",
    heading: "Rewards, tokens, XP & discounts",
    intro:
      "LaserOps runs XP, levels, game tokens, XP boosts, streaks, accolades, seasonal challenges, gifts and personal pricing to make playing more rewarding. The following apply to all of them.",
    items: [
      "“Rewards” means any benefit we grant to your account or offer through our games and store, including XP and levels, level-up unlocks and perks, game tokens, XP boosts (for example double XP and 1.5x XP), streak and accolade points, in-game achievements, seasonal challenges, gifted tokens, and any family and friends or promotional pricing or discount applied to your account.",
      "Rewards are a goodwill benefit, not an entitlement. Taking part, spending, or reaching any milestone does not entitle you to any reward, and no reward is guaranteed.",
      "We reserve the right, at our sole discretion and without prior notice, to issue, decline to issue, suspend, reduce, adjust the value of, expire, or revoke any and all rewards, in whole or in part, on any account. This includes changing how rewards are earned, what they are worth, and the rules that govern them.",
      "We may reverse, remove, or adjust any reward granted in error, through a technical fault, or through incorrect data, even after it appears on your account.",
      "Rewards may be withheld or revoked, and your account restricted, if we reasonably believe there has been cheating, exploiting, collusion, fraud, abuse of promotions, sharing or transferring rewards other than as we allow, or any breach of these terms.",
      "Rewards, including game tokens and any credit, have no cash value, cannot be exchanged, sold, or redeemed for cash, and are not your property. They may only be used within LaserOps as we allow.",
      "Rewards may expire (for example, tokens are valid for the period shown when they are issued) and are tied to your account and not transferable, except where we expressly provide a way to gift them.",
      "Any reduced or fixed price, family and friends rate, or discount on your account is a personal benefit granted at our discretion; we may change or remove it at any time.",
      "If your account is closed, suspended, or terminated, any unused rewards are forfeited and cannot be transferred, refunded, or reinstated.",
    ],
  },
  {
    label: "Store",
    heading: "Game tokens & the store",
    items: [
      "One game token entitles you to one game entry, subject to availability and booking a place.",
      "Tokens are credited to your account once your payment is confirmed. Bundle prices are shown at checkout and charged in full up front.",
      "Each bundle's tokens are valid for the period shown on the bundle and expire after it. Expired tokens cannot be used or refunded.",
      "Tokens have no cash value, are not transferable between accounts except through our gifting option, and are otherwise subject to our rewards terms above.",
    ],
  },
  {
    label: "Media",
    heading: "Photography & media",
    items: [
      "Games take place in a shared venue where photos and video may be taken. You may appear in match photos and in our gallery and marketing.",
      "Players can add and tag match photos through the site. Only add photos you have the right to share, and do not tag people who object.",
      "If you would like a photo of you removed, tell us and we will do so where reasonable.",
    ],
  },
  {
    label: "Your profile",
    heading: "Profiles & public stats",
    items: [
      "Your ops tag, level, stats, accolades, streaks, rivalries and match write-ups may be shown to other players on leaderboards, profiles and match reports.",
      "Match write-ups may be generated automatically. Stats and scores are provided as they are and may be corrected or recalculated.",
      "Choose an ops tag and squad name that are not offensive, misleading, or infringing. We may change or reset names that are not.",
    ],
  },
  {
    label: "Contact",
    heading: "Communications",
    items: [
      "We send account and booking messages (such as confirmations, reminders, calendar invites and refunds) as part of running your account.",
      "We only send marketing emails if you opt in, and you can opt out at any time.",
    ],
  },
  {
    label: "Legal",
    heading: "Liability, changes & governing law",
    items: [
      "The site, its stats, and its rewards are provided on a reasonable-efforts basis. We do not guarantee they will always be accurate, complete, or available.",
      "We may update these terms from time to time. Continuing to use your account after a change means you accept the updated terms.",
      "These terms are governed by the laws of Malta, and the Maltese courts have jurisdiction. Nothing in them affects your statutory consumer rights.",
    ],
  },
];

export default function TermsPage() {
  return (
    <>
      <section className="border-b border-border">
        <Container size="narrow" className="py-16 sm:py-20 lg:py-24">
          <span className="eyebrow">Legal</span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Terms &amp; Conditions
          </h1>
          <p className="mt-5 text-base leading-relaxed text-text-muted sm:text-lg">
            These terms govern your LaserOps Malta account, your bookings and payments, how you play, and the rewards we
            offer, alongside our{" "}
            <a href="/privacy" className="text-accent hover:text-accent-soft">
              Privacy Policy
            </a>{" "}
            and{" "}
            <a href="/cookies" className="text-accent hover:text-accent-soft">
              Cookie Policy
            </a>
            . By creating an account you agree to them.
          </p>
        </Container>
      </section>

      {SECTIONS.map((s, i) => (
        <section key={s.heading} className={`border-b border-border ${i % 2 === 0 ? "portal-surface" : ""}`}>
          <Container size="narrow" className="py-14 sm:py-16">
            <SectionLabel>{s.label}</SectionLabel>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">{s.heading}</h2>
            {s.intro && <p className="mt-5 text-text-muted">{s.intro}</p>}
            <ol className="mt-6 space-y-4">
              {s.items.map((item, j) => (
                <li key={j} className="flex gap-3 text-sm leading-relaxed text-text-muted">
                  <span className="shrink-0 font-bold text-accent">{j + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </Container>
        </section>
      ))}

      <section>
        <Container size="narrow" className="py-10">
          <p className="text-xs text-text-subtle">Last updated: September 2026.</p>
        </Container>
      </section>
    </>
  );
}
