/**
 * app/accolades/page.tsx
 * --------------------------------------------------------------------
 * Public "Streaks & Accolades" reference (linked under About). Explains what
 * accolades and streaks are and lists every active one with its badge, what it's
 * for, its tier, and the XP / ranking points it awards. Tapping a badge opens a
 * larger preview. Reads the admin-configured definitions (accolade_definitions +
 * streak_definitions), which are public-read. Accolade tiers are derived from the
 * XP they award (100 = Tier 3, 75 = Tier 2, else Tier 1); streaks carry their own.
 */
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";
import { AwardCard, type AwardCardData } from "@/components/portal/awards/AwardCard";

export const metadata: Metadata = {
  title: "Streaks & Accolades",
  description:
    "Every accolade and streak you can earn at LaserOps Malta — what each one is for, its tier, and the XP and ranking points it awards.",
};

type Accolade = AwardCardData & { scope: string };
type Streak = AwardCardData & { tier: number | null };

function accoladeTier(a: AwardCardData): number {
  const v = Number(a.xp ?? 0) || Number(a.points ?? 0);
  return v >= 100 ? 3 : v >= 75 ? 2 : 1;
}

function Section({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-xl font-extrabold uppercase tracking-tight text-text sm:text-2xl">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm text-text-muted">{blurb}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export default async function AccoladesPage() {
  const supabase = await createClient();
  const [{ data: accolades }, { data: streaks }] = await Promise.all([
    supabase
      .from("accolade_definitions")
      .select("name, description, badge_url, xp, points, scope")
      .eq("is_active", true)
      .order("xp", { ascending: false })
      .order("name"),
    supabase
      .from("streak_definitions")
      .select("name, description, badge_url, xp, points, tier")
      .eq("is_active", true)
      .order("tier")
      .order("points", { ascending: false })
      .order("name"),
  ]);

  const acc = (accolades ?? []) as Accolade[];
  const matchAcc = acc.filter((a) => a.scope === "match");
  const roundAcc = acc.filter((a) => a.scope === "round");
  const strk = (streaks ?? []) as Streak[];

  return (
    <Container size="wide" className="py-12 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <header className="border-b border-border pb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Rewards</p>
          <h1 className="mt-2 text-3xl font-extrabold uppercase tracking-tight text-text sm:text-5xl">Streaks &amp; Accolades</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-muted sm:text-base">
            There is one of each accolade awarded per match, to the player that achieved the highest or lowest of a
            scoring metric for that match. <span className="font-semibold text-text">Accolades</span> count towards your{" "}
            <span className="text-accent">Total XP</span>, which is used for levelling up and unlocking rewards.
            <span className="mt-3 block">
              <span className="font-semibold text-text">Streaks</span> are feats you pull off during play, and award{" "}
              <span className="text-accent">in-game points</span> that lift you up the match leaderboard.
            </span>
          </p>
        </header>

        {matchAcc.length > 0 && (
          <Section title="Match accolades" blurb="Awarded once per match, for how your whole game went.">
            {matchAcc.map((a) => (
              <AwardCard key={a.name} a={{ ...a, tier: accoladeTier(a) }} />
            ))}
          </Section>
        )}

        {roundAcc.length > 0 && (
          <Section title="Round accolades" blurb="Awarded within a single round of a match.">
            {roundAcc.map((a) => (
              <AwardCard key={a.name} a={{ ...a, tier: accoladeTier(a) }} />
            ))}
          </Section>
        )}

        {strk.length > 0 && (
          <Section title="Streaks" blurb="In-the-moment feats during play — chain the right actions together to earn them.">
            {strk.map((a) => (
              <AwardCard key={a.name} a={a} />
            ))}
          </Section>
        )}

        {acc.length === 0 && strk.length === 0 && (
          <p className="mt-12 text-sm text-text-muted">Accolades and streaks are being set up — check back soon.</p>
        )}
      </div>
    </Container>
  );
}
