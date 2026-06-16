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
      "who age 10 community open games corporate events stag hen birthday parties kids adults private bookings friend groups",
    answer: (
      <p>
        Anyone from age 10 upwards. We host community open games for regular
        players, corporate events, stag and hen dos, birthday parties for kids
        and adults, and private bookings for friend groups. If you can run
        between cover and press a trigger, the game has a version for you.
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
      "how much cost price €30 per person 3 hour session €300 minimum flat fee groups smaller than 10",
    answer: (
      <p>
        Standard rate is €30 per person for a 3-hour session. There is a €300
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
        Sessions vary by booking type. Our standard session is 3 hours long —
        the recommended length to maximise your experience — but we can be
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
        smaller side, get in touch and we&apos;ll let you know the options —
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
        your session and you get high quality images afterwards — the kind that
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
        <div className="mt-8 border border-border bg-bg-elevated px-6 py-10 text-center">
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
