import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Corporate Events & Team Building",
  alternates: { canonical: "/events/corporate" },
  description:
    "Laser tag corporate team building in Malta. Strategy, teamwork, and the rare chance to shoot your boss. Match photos, drinks, and post-game stats sorted.",
  openGraph: {
    title: "Corporate Events & Team Building Malta | LaserOps",
    description:
      "Laser tag corporate events in Malta. Strategy, teamwork, and the rare chance to shoot your boss. Match photos, drinks, and post game stats included.",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-accent">
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CorporateEventsPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-16 sm:py-20 lg:py-24">
          <span className="eyebrow">Corporate Events</span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Corporate Events That People Actually Talk About on Monday
          </h1>
          <p className="mt-5 text-base leading-relaxed text-text-muted sm:text-lg">
            If you&apos;re looking for something truly memorable and different for
            your next team building event, you&apos;ve come to the right place.
            LaserOps runs corporate events in Malta that employees actually look
            forward to — where strategy matters, communication is the difference
            between winning and losing, and yes, you finally get to shoot at your
            colleagues without a follow up meeting from HR.
          </p>
          <div className="mt-8">
            <Button href="/booking" variant="primary" size="lg">
              Book Your Team
            </Button>
          </div>
        </Container>
      </section>

      {/* ── Real Strategy ────────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Why It Works</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Real Strategy, Real Teamwork, No Forced Icebreakers
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              <Link href="/outdoor-laser-tag-malta" className="text-accent hover:underline">
                Laser tag
              </Link>{" "}
              works as a corporate event because it puts a team into a
              situation that demands the exact skills companies pretend to care
              about in workshops. You have an objective, limited time, limited
              information, and a group of people who need to coordinate to win.
              The team that talks to each other beats the team that doesn&apos;t,
              every single time (having fairly decent aim helps too).
            </p>
            <p className="leading-relaxed">
              Within the first match, patterns from the office start showing up
              in the arena. The quiet analyst turns out to be a tactical genius.
              The loudest person in meetings goes silent under pressure. Someone
              in middle management starts calling plays and the team actually
              listens. People see each other in a new light, and that&apos;s the part
              that sticks once everyone is back at their desks on Monday morning.
            </p>
            <p className="leading-relaxed">
              We run game modes that scale from quick skirmishes to longer
              objective based rounds, depending on what your group responds to.
              Smaller teams get tight, fast games that reset quickly between
              rounds. Larger groups get bigger formats with more moving parts,
              where coordination across squads becomes the deciding factor.
              Either way, the strategy and planning side is genuinely there if
              your team chooses to engage with it, and most groups do, whether
              they meant to or not.
            </p>
          </div>
        </Container>
      </section>

      {/* ── The Part Nobody Says Out Loud ────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>The Fun Part</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            The Part Nobody Says Out Loud
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              Let&apos;s be honest about something. A big reason corporate laser tag
              works is that for one afternoon, the org chart gets switched off.
              The junior can outflank the CEO. The finance team can ambush the
              marketing team from behind some bushes. Two senior managers who
              never agree on anything end up on the same side trying not to get
              sent back to spawn by an intern.
            </p>
            <p className="leading-relaxed">
              There&apos;s something genuinely funny about watching a director you
              usually only see in suits sprint across an arena with a laser
              tagger in hand, and that humour is half of what makes the day
              work. Nobody bonds over a PowerPoint. People bond over the story
              of how Charlene from accounts pulled off a flank that won the
              round.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Post Game Stats ──────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Player Portal</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Post Game Stats to Take Back to the Office
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              Every match at LaserOps is tracked by our persistent stat system,
              which means your corporate event doesn&apos;t end when the match does.
              We hand out post game stats showing score, kills, damage, accuracy,
              overall team performance, and more! All player stats will then be
              tied to their own profiles to keep building on in future games.
              This is where the real banter starts.
            </p>
            <p className="leading-relaxed">
              For office groups, this is gold. You walk back into work with hard
              data on who actually carried the team and who spent half the match
              hiding behind a wall. The numbers settle arguments and start new
              ones, and the group chat tends to stay alive for weeks. We&apos;ve had
              companies come back specifically because someone wanted a rematch
              to clear their name on the leaderboard.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Match Photography ────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Add-On</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            High Quality Match Photos for the Company Channels
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              Most corporate events end with three blurry phone photos that
              nobody wants to post. We offer professional match photography as
              an optional add on, with a photographer capturing the action
              across your session. You get high quality images of your team mid
              game, properly lit and properly framed, ready for internal
              newsletters, LinkedIn posts, end of year recap videos, or wherever
              else your marketing team needs decent content.
            </p>
            <p className="leading-relaxed">
              It&apos;s a small addition that makes a real difference to how the day
              gets remembered and shared. Companies that take the photos almost
              always end up using them.{" "}
              <Link
                href="/gallery"
                className="font-semibold text-accent underline underline-offset-4 hover:opacity-80"
              >
                Check some samples out in our online gallery!
              </Link>
            </p>
          </div>
        </Container>
      </section>

      {/* ── Catering & Drinks ────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Add-On</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Catering, Drinks, and the Bit Around the Games
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              A corporate event isn&apos;t just running around, and we can take care
              of the rest of it too. We handle catering for groups, so you
              don&apos;t need to coordinate a separate venue or have someone from the
              office running around with platters. Whether you would prefer to
              have a food truck to fit your cuisine of choice, or just have some
              pre-ordered hot meals waiting for when the match ends, we&apos;ll put
              together a package that fits your group and your budget.
            </p>
            <p className="leading-relaxed">
              Drinks are sorted on site as well. Soft drinks, beers, and the
              occasional something stronger for the people who lost badly and
              need to process it. Plenty of corporate groups treat the bar area
              as the second half of the event, hanging around after their
              session to swap stories, look through the stats together, and let
              the new starters figure out where they fit in the social order.
            </p>
            <p className="leading-relaxed">
              If you let us know what you&apos;re after when you book, we&apos;ll handle
              the food and drinks side end to end so your organiser doesn&apos;t have
              to think about it on the day.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Why Companies Keep Coming Back ───────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Team Building</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Why Companies Keep Coming Back
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              The phrase &ldquo;team building&rdquo; gets thrown around a lot, and most of
              what gets sold under that label fails for the same reason. It&apos;s too
              obviously an exercise. People know they&apos;re being team built at, and
              they shut down. Laser tag works because the team building happens
              as a side effect of trying to win a game, not because someone is
              standing at the front of a room asking everyone to share a fun
              fact about themselves.
            </p>
            <p className="leading-relaxed">
              You&apos;ll see communication improve in real time as teams figure out
              callouts and positioning. You&apos;ll see leadership emerge naturally as
              people step up to coordinate. You&apos;ll see colleagues laugh at each
              other and themselves in a way that doesn&apos;t happen in an escape
              room. By the end of the session the group dynamic has genuinely
              shifted, and the only &ldquo;exercise&rdquo; anyone did was running back and
              forth from spawn.
            </p>
            <p className="leading-relaxed">
              It also doesn&apos;t hurt that the same things that make our community
              come back week after week — balanced teams, real stats, actual
              stakes — make the corporate version of the day feel like a proper
              event rather than a glorified party game.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Group Sizes & Booking CTA ────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Book Your Event</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Group Sizes and What&apos;s Included
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              We host corporate groups across a wide range of sizes. Sessions
              are tailored to the group, with formats matched to numbers and
              energy levels, and our staff handle the briefing, refereeing, and
              team balancing on the day so your organiser doesn&apos;t have to manage
              anything once you arrive.
            </p>
            <p className="leading-relaxed">
              A standard corporate booking includes the arena, all the kit,
              multiple match formats, post-game stats, and a host running the
              session. Match photography, catering, and drinks are available as
              add ons, and we&apos;ll put a full package together for you if you want
              everything sorted in one go.
            </p>
          </div>
          <div className="mt-8">
            <Button href="/booking" variant="primary" size="lg">
              Book Your Team →
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}
