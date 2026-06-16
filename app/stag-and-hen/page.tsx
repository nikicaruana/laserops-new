import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { BracketFrame } from "@/components/portal/BracketFrame";
import { fetchImagesByTag, cloudinaryTransform } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stag & Hen Do Activities Malta | Laser Tag",
  alternates: { canonical: "/stag-and-hen" },
  description:
    "Stag dos and hen parties in Malta that don't end in a kebab and regret. Laser tag, match stats, drinks, catering, and a venue that handles the lot.",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-accent">
      {children}
    </span>
  );
}

const PHOTO_TRANSFORM = "w_900,c_fill,ar_4:3,q_auto,f_auto";

export default async function StagAndHenPage() {
  const photos = await fetchImagesByTag("stag");
  const topPhotos = photos.slice(0, 2);
  const bottomPhotos = photos.slice(2, 4);

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-16 sm:py-20 lg:py-24">
          <span className="eyebrow">Stag &amp; Hen</span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Stag and Hen Dos in Malta That Don&apos;t End in a Kebab and Regret
          </h1>
          <p className="mt-5 text-base leading-relaxed text-text-muted sm:text-lg">
            If you&apos;re the one organising the stag or hen do, you already know
            the problem. Half the group wants to go all in, the other half wants
            to get home in one piece, and somewhere in between you&apos;re meant to
            find an activity that everyone actually enjoys. Laser tag at
            LaserOps fits the brief better than most things on the list. It&apos;s
            competitive enough for the people who came to win, daft enough for
            the people who came for the photos, and it gives the whole group a
            shared story that doesn&apos;t depend on anyone being twelve drinks deep.
          </p>
          <div className="mt-8">
            <Button href="/booking" variant="primary" size="lg">
              Book Your Group
            </Button>
          </div>
        </Container>
      </section>

      {/* ── Top photo pair ───────────────────────────────────── */}
      {topPhotos.length >= 2 && (
        <section className="border-b border-border">
          <Container size="narrow" className="py-10">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {topPhotos.map((photo) => (
                <BracketFrame
                  key={photo.publicId}
                  cornerSize="1.25rem"
                  thickness="2px"
                  inset="-5px"
                >
                  <img
                    src={cloudinaryTransform(photo.secureUrl, PHOTO_TRANSFORM)}
                    alt={photo.caption ?? "LaserOps Malta stag & hen"}
                    className="block aspect-[4/3] w-full object-cover"
                  />
                </BracketFrame>
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* ── A Proper Activity ────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>The Activity</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            A Proper Activity, Not Just Something to Pad the Itinerary
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              A lot of stag and hen activities feel like filler between the bar
              and the next bar. Laser tag actually gives the group something to
              do that fills up a good portion of the day. You have teams,
              objectives, and a real game with real stakes, and within a couple
              of rounds people who barely know each other are calling out
              positions and arguing about strategy.
            </p>
            <p className="leading-relaxed">
              It works especially well for groups that don&apos;t all know each other
              going in. The bride&apos;s school friends and the groom&apos;s work crowd
              don&apos;t always click on a pub crawl, but stick them on the same team
              for a round and they sort it out fast. Nothing breaks the ice quite
              like getting flanked together.
            </p>
          </div>
        </Container>
      </section>

      {/* ── The Main Target ──────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>The Fun Part</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            The Stag or Hen Becomes the Main Target. Obviously.
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              Let&apos;s not pretend otherwise. Half the appeal of bringing a stag or
              hen group to laser tag is that the guest of honour spends the
              entire session getting hunted by everyone they&apos;ve ever met. We can
              build that into the format. Free for all rounds where the stag or
              hen has a target on their back, team modes where they always end up
              on the losing side by sheer coincidence, special objectives that
              put them in the open. Whatever the group wants to inflict, we&apos;ll
              set it up.
            </p>
            <p className="leading-relaxed">
              It&apos;s all in good fun, the bride or groom usually gets their own
              back at some point, and the post game stats give everyone something
              to roast them with for the rest of the night.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Stats ────────────────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Player Portal</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Stats and Bragging Rights for the Group Chat
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              Every match is tracked by our persistent stat system, so when the
              session wraps up everyone walks out with numbers. Accuracy, kills,
              round wins, who got sent back to spawn the most times, who hid in
              a corner the whole match. The group chat from the trip stays alive
              for weeks afterwards, and the stag or hen tends to feature heavily
              in the screenshots.
            </p>
            <p className="leading-relaxed">
              If your group is the kind that takes things seriously, the stats
              give the competitive ones something real to fight over. If your
              group is the kind that takes nothing seriously, the stats give
              everyone material for the speeches at the wedding.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Match Photos ─────────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Add-On</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Match Photos to Send to the Group Chat the Next Day
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              We offer professional match photography as an optional add on. A
              photographer captures the action across your session and you get
              high quality images of the group mid game, properly framed and
              properly lit. Far better than the blurry phone shots someone&apos;s
              cousin tried to take through the arena window.
            </p>
            <p className="leading-relaxed">
              These end up being the photos that actually get used. Wedding
              slideshows, speeches, the printed photo someone frames as a gag
              gift. Worth the small extra cost on the day for what you get back
              later.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Catering & Drinks ────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Add-On</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Catering and Drinks, All Sorted On Site
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              A laser tag session is a great anchor for the day, but it&apos;s not
              the whole day. We can handle the food and drinks side too, so you
              don&apos;t need to march the group to a different venue afterwards while
              half of them are still arguing about the last round.
            </p>
            <p className="leading-relaxed">
              Tell us what kind of group you&apos;ve got and what kind of food
              you&apos;d prefer, and we&apos;ll put together a package that works.
            </p>
            <p className="leading-relaxed">
              Drinks are sorted on site. Soft drinks, beers, and stronger
              options for the group that&apos;s just getting started. Plenty of stag
              and hen groups make a proper afternoon or evening of it, playing
              the matches, hanging around for food, and using the venue as the
              launch pad for whatever comes next.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Bottom photo pair ────────────────────────────────── */}
      {bottomPhotos.length >= 2 && (
        <section className="border-b border-border">
          <Container size="narrow" className="py-10">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {bottomPhotos.map((photo) => (
                <BracketFrame
                  key={photo.publicId}
                  cornerSize="1.25rem"
                  thickness="2px"
                  inset="-5px"
                >
                  <img
                    src={cloudinaryTransform(photo.secureUrl, PHOTO_TRANSFORM)}
                    alt={photo.caption ?? "LaserOps Malta stag & hen"}
                    className="block aspect-[4/3] w-full object-cover"
                  />
                </BracketFrame>
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* ── Group Sizes & Booking CTA ────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>What&apos;s Included</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Group Sizes and What&apos;s Included
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              We handle stag and hen groups across a wide range of sizes, from
              intimate parties of close friends to bigger combined groups.
              Sessions are tailored to the group, with formats matched to
              numbers and energy levels, and our staff run the briefing,
              refereeing, and matchmaking on the day so the person organising
              can finally stop organising and just enjoy themselves.
            </p>
            <p className="leading-relaxed">
              A standard booking includes the location, all the kit, multiple
              match formats, post game stats, and a host running the session.
              Match photography, catering, and drinks are available as add ons,
              and we&apos;ll put a full package together for you if you want the
              whole thing handled in one booking.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Why It Beats the Usual Options ───────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Why LaserOps</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Why It Beats the Usual Options
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              A stag or hen do lives or dies on whether the group has actually
              had a good time, and the usual activities have a way of splitting
              the room. Some people don&apos;t drink. Some people don&apos;t fit in the
              go karts. Most people don&apos;t want to get shot in the neck with a
              paint ball. Some people quietly hate escape rooms. Laser tag is
              one of the rare options that works across age ranges, fitness
              levels, and personality types, because the game adjusts to whoever
              is playing it.
            </p>
            <p className="leading-relaxed">
              The competitive ones get to compete. The casual ones get to muck
              around. Nobody gets stuck doing something they didn&apos;t sign up for,
              and everyone walks out with the same set of stories.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Booking CTA ──────────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Book Your Event</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Book Your Stag or Hen Do
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              If you&apos;re planning the day for someone and you&apos;ve run out of ideas
              that don&apos;t make you cringe, get in touch and we&apos;ll build a session
              that suits your group. Tell us roughly how many people, what the
              energy is meant to be, and whether the stag or hen needs to be
              specifically targeted — they usually do — and we&apos;ll handle the
              rest.
            </p>
          </div>
          <div className="mt-8">
            <Button href="/booking" variant="primary" size="lg">
              Book Your Stag or Hen Do →
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}
