/**
 * app/player-portal/squads/help/page.tsx
 * --------------------------------------------------------------------
 * Player-facing explainer for how squads and squad priority work, including
 * the competitive-season lock and the representation rule. Static content.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "How squads work",
  description: "How squads, squad priority and competitive seasons work on LaserOps.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="portal-card px-5 py-5 sm:px-6 sm:py-6">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-accent">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-text-muted">{children}</div>
    </section>
  );
}

export default function SquadHelpPage() {
  return (
    <Container size="default" className="py-10 sm:py-14">
      <header className="mb-8 border-b border-border pb-6">
        <Link href="/player-portal/squads" className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-text-subtle hover:text-accent">
          &larr; Back to squads
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold uppercase tracking-tight text-text sm:text-4xl">How squads work</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          Everything you need to know about joining squads, setting your priority, and how it all ties into the competitive season.
        </p>
      </header>

      <div className="space-y-5">
        <Section title="The basics">
          <ul className="list-disc space-y-2 pl-5">
            <li>You can be a member of up to <strong className="text-text">two squads</strong> at once.</li>
            <li>You can <strong className="text-text">create one squad</strong> of your own. Creating a squad makes you its captain.</li>
            <li>A squad holds up to <strong className="text-text">20 primary members</strong>. Players whose primary squad is elsewhere can join as secondary members without counting toward that cap.</li>
            <li>Roles are <strong className="text-text">captain</strong>, <strong className="text-text">officer</strong> and <strong className="text-text">member</strong>. You can only be a captain or officer in your primary squad.</li>
          </ul>
        </Section>

        <Section title="Primary vs secondary squad">
          <p>
            One of your squads is your <strong className="text-text">primary</strong> squad. It is the squad you represent and earn for in competitive play. Your first squad is automatically your primary; a second squad you join becomes your secondary.
          </p>
          <p>
            Outside a competitive season you can switch which squad is your primary at any time from the squad page. You always have exactly one primary squad.
          </p>
        </Section>

        <Section title="During a competitive season">
          <p>
            When a season starts, your squad priority is <strong className="text-text">locked for the whole season</strong>. Your primary squad is whatever it is set to the moment the season begins, so set it before the season kicks off. While the season is active you cannot:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>switch your primary squad;</li>
            <li>leave your primary squad while you still hold a second squad;</li>
            <li>create another squad or take over one as captain.</li>
          </ul>
          <p>
            You can still join a second squad as a secondary member, and leave a secondary squad. Everything unlocks again when the season ends.
          </p>
        </Section>

        <Section title="Playing competitive matches">
          <p>
            In a squad-vs-squad match you represent the squad you are a member of. If <strong className="text-text">both squads in a match are yours</strong>, you always line up for your <strong className="text-text">primary</strong> squad. You can never field your secondary squad against your primary.
          </p>
          <p>
            A game is always credited to the squad you actually played it with, recorded when you sign up. Changing your priority later never re-credits past games.
          </p>
        </Section>

        <Section title="Ladder standing">
          <p>
            A squad&rsquo;s ladder position is seeded from the total lifetime XP of its <strong className="text-text">primary</strong> members. Your XP counts toward the one squad you compete for, so being a secondary member somewhere else never splits your contribution.
          </p>
        </Section>

        <p className="pt-2 text-center text-xs text-text-subtle">
          Still have a question? <Link href="/contact" className="text-accent hover:text-accent-soft">Get in touch</Link>.
        </p>
      </div>
    </Container>
  );
}
