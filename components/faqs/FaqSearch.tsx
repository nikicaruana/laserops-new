"use client";

import { useState, useMemo, useId } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// FAQ data
// ---------------------------------------------------------------------------

type FaqItem = {
  id: string;
  question: string;
  /** Plain text used for search matching (strip any link labels). */
  searchText: string;
  answer: React.ReactNode;
};

const WHATSAPP_COMMUNITY = "https://chat.whatsapp.com/Duox9CiCmasKsv8tcuQScZ";

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "what-is",
    question: "What actually is laser tag at LaserOps?",
    searchText:
      "what is laser tag laserops outdoor arena kit tracks shot tag objective real time strategy teamwork stat system",
    answer: (
      <p>
        <Link href="/outdoor-laser-tag-malta" className="text-accent hover:underline">
          Outdoor laser tag
        </Link>
        , played in a proper arena, with kit that tracks every
        shot, tag, and objective in real time. Not the kids&apos; party version
        with foam barriers and music. The game runs on real strategy, real
        teamwork, and a stat system that follows you between sessions.
      </p>
    ),
  },
  {
    id: "who-is-it-for",
    question: "Who is it for?",
    searchText:
      "who age 13 open games younger under 13 private bookings community corporate events stag hen birthday parties kids adults friend groups",
    answer: (
      <p>
        Open games are for ages 13 and up. We also host corporate events, stag
        and hen dos, birthday parties for kids and adults, and private bookings
        for friend groups, where younger ages can be accommodated in the right
        setting. If you can run between cover and press a trigger, the game has
        a version for you.
      </p>
    ),
  },
  {
    id: "where",
    question: "Where do you play?",
    searchText:
      "where location venue different locations booking process come to you own venue",
    answer: (
      <p>
        There are a number of different locations that we use for games, which
        can be discussed during the booking process. Have your own venue? We can
        come to you!
      </p>
    ),
  },
  {
    id: "cost",
    question: "How much does it cost?",
    searchText:
      "how much cost price €35 per person 3 hour session €300 minimum flat fee groups smaller than 10",
    answer: (
      <p>
        Standard rate is €35 per person for a 3-hour session. There is a €300
        minimum flat fee for groups smaller than 10.
      </p>
    ),
  },
  {
    id: "experience",
    question: "Do I need any experience?",
    searchText:
      "experience beginner never played before staff briefing team balancing rules first round",
    answer: (
      <p>
        No. Most people who walk in have never played proper laser tag before.
        Our staff handle the briefing, the team balancing, and the rules, so
        you can pick it up in your first round.
      </p>
    ),
  },
  {
    id: "session-length",
    question: "How long does a session last?",
    searchText:
      "how long session 3 hours standard recommended flexible booking type",
    answer: (
      <p>
        Sessions vary by booking type. Our standard session is 3 hours long –
        the recommended length to maximise your experience – but we can be
        flexible to your needs.
      </p>
    ),
  },
  {
    id: "group-size",
    question: "How many people do you need for a booking?",
    searchText:
      "how many people group size 16v16 small open game community teams filled",
    answer: (
      <p>
        We handle small groups through to 16v16 games. If your group is on the
        smaller side, get in touch and we&apos;ll let you know the options –
        including joining an{" "}
        <Link href="/community" className="text-accent hover:underline">
          open game
        </Link>{" "}
        where teams get filled out from the wider community.
      </p>
    ),
  },
  {
    id: "what-to-wear",
    question: "What should I wear?",
    searchText:
      "wear clothes closed shoes layers sweaty bright white kit provided",
    answer: (
      <p>
        Anything you can move in. Closed shoes, layers you don&apos;t mind
        getting sweaty, and ideally not bright white if you&apos;d rather not
        stand out in the arena. We provide all the kit you actually need to
        play.
      </p>
    ),
  },
  {
    id: "catering",
    question: "Can you handle food and drinks?",
    searchText:
      "food drinks catering package available throughout book",
    answer: (
      <p>
        Yes. We can work towards getting the kind of catering that you desire,
        and drinks are available throughout. Tell us what you&apos;re after when
        you{" "}
        <Link href="/booking" className="text-accent hover:underline">
          book
        </Link>{" "}
        and we&apos;ll put a package together.
      </p>
    ),
  },
  {
    id: "photography",
    question: "Do you offer match photography?",
    searchText:
      "match photography optional add on photographer high quality images speeches slideshows social posts",
    answer: (
      <p>
        Yes, as an optional add on. A photographer captures the action across
        your session and you get high quality images afterwards – the kind that
        actually get used in speeches, slideshows, and social posts rather than
        left in a camera roll.
      </p>
    ),
  },
  {
    id: "stats",
    question: "What are the post game stats?",
    searchText:
      "post game stats score kills damage accuracy persistent stat system full breakdown between visits",
    answer: (
      <p>
        Every match is tracked by our persistent stat system. Score, Kills,
        Damage, Accuracy, and more. You walk out of every session with a full
        breakdown, and if you keep playing your stats follow you between visits.
      </p>
    ),
  },
  {
    id: "player-profile",
    question: "Do I need an account to play?",
    searchText:
      "account player profile sign in google free stats xp levels unlocks history follows email claim register",
    answer: (
      <p>
        You can just show up and play, but a free{" "}
        <Link href="/player-portal" className="text-accent hover:underline">
          player profile
        </Link>{" "}
        is what tracks your stats, XP, levels and unlocks, and lets you join open games online. Sign
        in with Google, and if you&apos;ve played with us before, your past games attach to your
        profile automatically when you use the email you registered with.
      </p>
    ),
  },
  {
    id: "xp-levels",
    question: "How do XP and levels work?",
    searchText:
      "xp levels progression earn points performance wins accolades level up unlocks rewards boosts carry over between sessions",
    answer: (
      <p>
        You earn XP every game, from your performance, round and match wins, and any accolades you
        pick up. XP builds your level, and levelling up unlocks rewards like XP boosts. It all
        carries over between sessions.
      </p>
    ),
  },
  {
    id: "tokens",
    question: "What are LaserOps game tokens?",
    searchText:
      "game tokens prepaid credits 1 token 1 game bundle store part pay online cheaper buy",
    answer: (
      <p>
        Prepaid game credits, where 1 token = 1 game. Buy them in bundles from the{" "}
        <Link href="/player-portal/store" className="text-accent hover:underline">
          store
        </Link>{" "}
        (cheaper per game than paying each time), then use them to pay for any game. You can even
        part-pay, putting a fraction of a token towards a game and paying the rest online.
      </p>
    ),
  },
  {
    id: "token-expiry",
    question: "Do game tokens expire?",
    searchText:
      "tokens expire 6 months validity wallet soonest first lose expiry breakdown earned gifted bought",
    answer: (
      <p>
        Yes, tokens are valid for 6 months from when you get them, whether bought, gifted or earned.
        Your wallet shows exactly how many expire and when, and when you spend tokens the ones
        expiring soonest are always used first, so you never lose them unnecessarily. The details are
        in our{" "}
        <Link href="/terms" className="text-accent hover:underline">
          terms
        </Link>
        .
      </p>
    ),
  },
  {
    id: "token-gift",
    question: "Can I gift game tokens?",
    searchText:
      "gift tokens present someone email claim no account 6 months validity",
    answer: (
      <p>
        Yes. You can buy tokens as a gift, even for someone who doesn&apos;t have an account yet, and
        they claim them when they sign in. Gifted tokens carry the same 6-month validity.
      </p>
    ),
  },
  {
    id: "open-games",
    question: "What are open games and how do I join one?",
    searchText:
      "open games public join solo friends reserve spot pay token online booking portal community teams filled",
    answer: (
      <p>
        Open games are public games anyone can join. Browse upcoming games on the{" "}
        <Link href="/booking" className="text-accent hover:underline">
          booking page
        </Link>{" "}
        or in your player portal, reserve your spot, and pay with a token or online. Perfect if
        you&apos;re coming solo or with a few friends, teams get filled out from the community.
      </p>
    ),
  },
  {
    id: "beginner-games",
    question: "What are beginner games?",
    searchText:
      "beginner games level cap new players maximum level veterans fair over cap",
    answer: (
      <p>
        Some open games are flagged for beginners, with a maximum player level so newer players can
        enjoy a game without going up against seasoned veterans. If you&apos;re above the cap
        you&apos;ll see it noted on the game and won&apos;t be able to join that one.
      </p>
    ),
  },
  {
    id: "cancellation",
    question: "What is the cancellation and refund policy?",
    searchText:
      "cancel cancellation refund policy 48 hours full automatic 24 hours request non refundable pass spot",
    answer: (
      <p>
        Cancel more than 48 hours before a game for an automatic full refund. Between 48 and 24 hours
        before, refunds are by request. Within 24 hours the game is non-refundable, but you can
        always pass your spot to another player. Full details are in our{" "}
        <Link href="/terms" className="text-accent hover:underline">
          terms
        </Link>
        .
      </p>
    ),
  },
  {
    id: "squads-ladders",
    question: "What are squads, ladders and accolades?",
    searchText:
      "squads team friends banner ladders competitive seasonal rankings leaderboards accolades streaks badges portal",
    answer: (
      <p>
        Squads let you team up with friends under one banner; ladders are competitive seasonal
        rankings; and{" "}
        <Link href="/accolades" className="text-accent hover:underline">
          accolades and streaks
        </Link>{" "}
        are badges you earn for standout performances, like topping the kills or stringing together a
        streak. You&apos;ll find them all in your player portal.
      </p>
    ),
  },
  {
    id: "match-report-photos",
    question: "Can I see my match report and photos?",
    searchText:
      "match report stats breakdown scores kills accuracy objectives photos gallery games played filter",
    answer: (
      <p>
        Yes. After each game you get a full match report, with scores, kills, accuracy, objectives
        and more, and any photos from your sessions appear in the{" "}
        <Link href="/gallery" className="text-accent hover:underline">
          gallery
        </Link>
        , filterable to the games you played in.
      </p>
    ),
  },
  {
    id: "how-to-book",
    question: "How do I book?",
    searchText:
      "how book contact page message size group event booking",
    answer: (
      <p>
        Get in touch through the{" "}
        <Link href="/booking" className="text-accent hover:underline">
          booking page
        </Link>{" "}
        or drop us a message. Tell us roughly what you&apos;re after, the size
        of the group, and the kind of event, and we&apos;ll handle it from
        there.
      </p>
    ),
  },
  {
    id: "community",
    question: "How do I join the community side of things?",
    searchText:
      "join community whatsapp open games new players first session no commitment",
    answer: (
      <p>
        The{" "}
        <a
          href={WHATSAPP_COMMUNITY}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          WhatsApp community
        </a>{" "}
        is the easiest way in. Open games get posted there, new players are
        welcomed, and you can show up to your first session without committing
        to anything in advance.
      </p>
    ),
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalise(s: string) {
  return s.toLowerCase().replace(/['']/g, "'");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FaqSearch() {
  const [query, setQuery] = useState("");
  const inputId = useId();

  const filtered = useMemo(() => {
    const q = normalise(query.trim());
    if (!q) return FAQ_ITEMS;
    return FAQ_ITEMS.filter(
      (item) =>
        normalise(item.question).includes(q) ||
        normalise(item.searchText).includes(q),
    );
  }, [query]);

  return (
    <div>
      {/* ── Search bar ──────────────────────────────────────── */}
      <div className="relative">
        <label htmlFor={inputId} className="sr-only">
          Search FAQs
        </label>
        {/* Search icon */}
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions…"
          className="h-12 w-full rounded-none border border-border bg-bg pl-11 pr-10 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Result count (only shown while searching) ────────── */}
      {query.trim() && (
        <p className="mt-3 text-xs text-text-muted">
          {filtered.length === 0
            ? "No questions match that search."
            : `${filtered.length} question${filtered.length === 1 ? "" : "s"} found`}
        </p>
      )}

      {/* ── FAQ list ─────────────────────────────────────────── */}
      {filtered.length > 0 ? (
        <dl className="mt-8 divide-y divide-border">
          {filtered.map((item) => (
            <div key={item.id} className="py-6 first:pt-0 last:pb-0">
              <dt className="text-base font-bold leading-snug tracking-tight text-text sm:text-lg">
                {item.question}
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-text-muted sm:text-base">
                {item.answer}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="mt-8 portal-card px-6 py-10 text-center">
          <p className="text-sm text-text-muted">
            Nothing matched &ldquo;{query}&rdquo;.{" "}
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-accent hover:underline"
            >
              Clear search
            </button>{" "}
            to see all questions, or{" "}
            <a
              href="/contact"
              className="text-accent hover:underline"
            >
              get in touch
            </a>{" "}
            if you can&apos;t find what you need.
          </p>
        </div>
      )}
    </div>
  );
}
