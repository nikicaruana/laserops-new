import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Laser Tag Birthday Parties Malta",
  alternates: { canonical: "/birthday-parties" },
  description:
    "Laser tag birthday parties in Malta for kids, teens, and adults. Real game, balanced teams, match stats, and catering sorted. The party they'll talk about for months.",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-accent">
      {children}
    </span>
  );
}

export default function BirthdayPartiesPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-16 sm:py-20 lg:py-24">
          <span className="eyebrow">Birthday Parties</span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Birthday Parties That Beat the Usual Options
          </h1>
          <div className="mt-5 space-y-4 text-base leading-relaxed text-text-muted sm:text-lg">
            <p>
              Birthday parties have a habit of falling into the same handful of
              formats. Bowling, go carting, arcade, the same restaurant with the
              same set menu. They&apos;re fine. Nobody actively dislikes them.
              But &ldquo;fine&rdquo; isn&apos;t really what you want for a birthday, and a
              laser tag party at LaserOps gives you something the kid (or the
              adult) will actually remember.
            </p>
            <p>
              It works because the game itself does the heavy lifting. You
              don&apos;t need to plan activities, run games, or keep the group
              entertained between cake and presents. You drop them into the
              arena and they sort themselves out, and the only problem you&apos;ll
              have is getting them to leave at the end.
            </p>
          </div>
          <div className="mt-8">
            <Button href="/booking" variant="primary" size="lg">
              Book Your Party
            </Button>
          </div>
        </Container>
      </section>

      {/* ── For Kids ─────────────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>For Kids</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Birthday Parties for Kids From 13 and Up
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              Our birthday format runs from age 13 upwards, which covers the
              full stretch from school birthdays through to teenagers. The thing
              about laser tag for younger ages is that it doesn&apos;t matter where
              the group sits on the social spectrum. The quiet kid and the louder
              kid both end up running around the arena in exactly the same way,
              and the standard birthday awkwardness of &ldquo;what do we do now&rdquo;
              never really shows up.
            </p>
            <p className="leading-relaxed">
              Our staff run the session, balance the teams, explain the rules,
              and keep things moving, so the parent organising the party can
              actually sit down for once. Teams get sorted out so nobody&apos;s stuck
              on the losing side every round, and the formats shift between
              matches to keep things interesting.
            </p>
            <p className="leading-relaxed">
              If the birthday kid wants to be specifically targeted, specifically
              protected, or given a special objective, just tell us when you book
              and we&apos;ll build it into the session.
            </p>
          </div>
        </Container>
      </section>

      {/* ── For Adults ───────────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>For Adults</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Birthday Parties for Adults Too
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              The &ldquo;adults don&apos;t have proper birthday parties anymore&rdquo; thing is
              mostly because the options for adult birthdays are bleak. A meal.
              Drinks at the same place you always go. Maybe karaoke if
              someone&apos;s feeling brave. Laser tag works as an adult birthday
              because it&apos;s an actual activity that gives the group something to
              do beyond standing around with a drink in hand making small talk.
            </p>
            <p className="leading-relaxed">
              It also scales nicely with the energy of the group. Take it
              seriously and it&apos;s a proper competitive afternoon. Take it lightly
              and it&apos;s an excuse to mess around with your friends in a way you
              stopped doing somewhere around age 22. Either works, and most
              groups end up doing a bit of both.
            </p>
            <p className="leading-relaxed">
              The post game stats give the group plenty to argue about over food
              afterwards, and the photos give everyone something to send to the
              group chat for weeks.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Stats ────────────────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Player Portal</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Stats and the Birthday Leaderboard
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              Every match is tracked by our persistent stat system, so by the
              end of the session you&apos;ve got a full breakdown of how everyone
              played. Accuracy, kills, who won the most rounds, who spent the
              most time getting sent back to spawn. The birthday kid usually
              demands to know where they finished. Sometimes that&apos;s a good
              thing. Sometimes it&apos;s not.
            </p>
            <p className="leading-relaxed">
              For kids&apos; parties, the stats turn into a natural way to hand out
              little awards at the end. Most accurate, most damage, least deaths,
              that sort of thing. For adult parties, they turn into the basis of
              arguments that last well into the night.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Match Photos ─────────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Add-On</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Match Photos for the Birthday Album
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              We offer professional match photography as an optional add on. A
              photographer captures the action across your session, and you get
              proper photos of the group mid game instead of the blurry phone
              shots that usually come out of birthday parties.
            </p>
            <p className="leading-relaxed">
              For kids&apos; parties this is the stuff that ends up on the fridge.
              For adult parties, it&apos;s social media-worthy material that ends up
              used long past the day itself. Worth the extra cost on the day for
              what you get back later.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Catering ─────────────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Add-On</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Catering and Drinks, All Handled On Site
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              The food, the drinks, the bit where everyone sits down for half an
              hour and stops running around. We can take care of all of it.
            </p>
            <p className="leading-relaxed">
              Catering options range from pizzas and finger food for kids&apos;
              parties through to meals for adult groups. Tell us roughly what
              you&apos;re after and the size of the group and we&apos;ll put together a
              package that fits. If you want to bring your own cake we&apos;ll
              happily set it up for the moment when everyone sings, and we&apos;ll
              deal with the candles, the plates, and the mess afterwards.
            </p>
            <p className="leading-relaxed">
              Drinks are sorted on site as well. Soft drinks for the kids&apos;
              parties, beers and the rest of it for the adult ones. Plenty of
              birthday groups treat the venue as the whole party from start to
              finish, which saves you running between two locations on the day.
            </p>
          </div>
        </Container>
      </section>

      {/* ── What's Included ──────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>What&apos;s Included</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            What&apos;s Included in a Birthday Booking
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              A standard birthday booking includes the location, all the kit,
              multiple match formats, post game stats, and a host running the
              session. Match photography, catering, and drinks are available as
              add ons, and we&apos;ll put a full package together for you if you want
              everything sorted in one go.
            </p>
            <p className="leading-relaxed">
              The party space is yours for the duration of the booking, which
              means you&apos;ve got somewhere to set up cake, presents, and
              decorations without having to fight for table space. Bring your
              own decorations if you want to make it more personal, or keep it
              simple and let the laser tag do the work.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Why It Works ─────────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Why LaserOps</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Why Birthday Groups Come Back
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              The honest reason laser tag works for birthdays is that it&apos;s one
              of the few activities that genuinely entertains a mixed group.
              Kids&apos; parties always have the one kid who&apos;s shy, the one kid
              who&apos;s hyper, and the parent who got dragged along. Adult parties
              always have the friend who didn&apos;t really want to come and the
              partner who doesn&apos;t know anyone. Laser tag pulls all of them in
              within about ten minutes, because the game doesn&apos;t care who you
              are. You either play it or you watch from the side, and almost
              nobody chooses to watch.
            </p>
            <p className="leading-relaxed">
              By the end of the session you&apos;ve got a group that&apos;s properly
              warmed up, plenty of material for the rest of the day, and a
              birthday person who&apos;s had an actual experience instead of another
              meal at the same place.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Booking CTA ──────────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Book Your Party</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Book a Birthday Party
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              If you&apos;re planning a birthday for a kid, a teenager, an adult, or
              yourself, get in touch and we&apos;ll build a session that fits your
              group. Tell us the age range, rough numbers, and whether you want
              catering and drinks handled, and we&apos;ll take it from there.
            </p>
          </div>
          <div className="mt-8">
            <Button href="/booking" variant="primary" size="lg">
              Book a Birthday Party →
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}
