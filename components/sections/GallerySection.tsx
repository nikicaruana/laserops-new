"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/**
 * Gallery section — mixed-content social proof.
 *
 * MOBILE/TABLET (< xl): two horizontal scroll rows with scroll-snap-center
 *   Row 1: Instagram posts (swipe through)
 *   Row 2: Google reviews (swipe through)
 *   Each row has its own eyebrow + (optional) "view all" link.
 *   Items are duplicated 3× and the row is initially scrolled to the
 *   middle copy, giving an effectively infinite-feeling swipe in either
 *   direction. Cards are 75vw wide with 12.5vw padding on each side so
 *   the focused card centers in the viewport with peek on both sides.
 *
 * DESKTOP (xl+): unified 3-column grid mixing both content types.
 *
 * Data source:
 *   - Preferred: CMS-driven via props from the server. The homepage
 *     page.tsx fetches Instagram_Posts and Google_Reviews from the CMS
 *     and passes them in.
 *   - Fallback: hardcoded sample data baked into this component —
 *     used when the CMS has no data yet (e.g. during initial staging,
 *     or if the CMS fetch fails). Lets the section render meaningfully
 *     in dev / preview environments without requiring an active CMS.
 */

// === Data shapes ===
type InstagramItem = {
  id: string;
  imageSrc: string;
  caption: string;
  postUrl: string;
};

type ReviewItem = {
  id: string;
  rating: number;
  quote: string;
  reviewer: string;
  relativeTime: string;
  reviewsUrl: string;
};

// === Fallback sample data ===
// Used when the CMS has no entries (e.g. before any data is added, or if
// the CMS fetch failed). Keeps the section meaningful in staging / dev.
const sampleInstagramItems: InstagramItem[] = [
  {
    id: "ig1",
    imageSrc: "/images/gallery/action-1.jpg",
    caption: "Squad up. Match day at the quarry.",
    postUrl: "https://instagram.com/laseropsmalta",
  },
  {
    id: "ig2",
    imageSrc: "/images/gallery/action-2.jpg",
    caption: "Capture the flag — final round chaos.",
    postUrl: "https://instagram.com/laseropsmalta",
  },
  {
    id: "ig3",
    imageSrc: "/images/gallery/action-3.jpg",
    caption: "Sunset ops. Visibility low, intensity high.",
    postUrl: "https://instagram.com/laseropsmalta",
  },
  {
    id: "ig4",
    imageSrc: "/images/gallery/action-4.jpg",
    caption: "When the squad rotates left flank.",
    postUrl: "https://instagram.com/laseropsmalta",
  },
  {
    id: "ig5",
    imageSrc: "/images/gallery/action-5.jpg",
    caption: "Search & destroy. Last man standing wins.",
    postUrl: "https://instagram.com/laseropsmalta",
  },
  {
    id: "ig6",
    imageSrc: "/images/gallery/action-6.jpg",
    caption: "Real weapons, real terrain, real tactics.",
    postUrl: "https://instagram.com/laseropsmalta",
  },
];

const sampleReviewItems: ReviewItem[] = [
  {
    id: "gr1",
    rating: 5,
    quote:
      "Honestly the best birthday party we've thrown for our 12-year-old. The team made it feel like a real military exercise.",
    reviewer: "Maria F.",
    relativeTime: "3 weeks ago",
    reviewsUrl: "https://maps.google.com/?cid=laserops",
  },
  {
    id: "gr2",
    rating: 5,
    quote:
      "Stag party absolutely loved it. Way more fun than expected. The outdoor terrain makes a huge difference vs indoor laser tag.",
    reviewer: "James C.",
    relativeTime: "1 month ago",
    reviewsUrl: "https://maps.google.com/?cid=laserops",
  },
  {
    id: "gr3",
    rating: 5,
    quote:
      "Booked for our company team-building. Everyone was buzzing afterwards. Already planning the rematch.",
    reviewer: "Sandra K.",
    relativeTime: "2 months ago",
    reviewsUrl: "https://maps.google.com/?cid=laserops",
  },
  {
    id: "gr4",
    rating: 5,
    quote:
      "Game changer. Way more thrilling than paintball — no bruises and the missions are properly tactical.",
    reviewer: "Daniel B.",
    relativeTime: "2 months ago",
    reviewsUrl: "https://maps.google.com/?cid=laserops",
  },
];

/**
 * Props for GallerySection. Both arrays are optional — when omitted or
 * empty, the component falls back to its baked-in sample data so the
 * homepage stays visually populated regardless of CMS state.
 */
type GallerySectionProps = {
  instagramItems?: InstagramItem[];
  reviewItems?: ReviewItem[];
};

export function GallerySection({
  instagramItems: instagramItemsProp,
  reviewItems: reviewItemsProp,
}: GallerySectionProps = {}) {
  // Use CMS data if provided AND non-empty; otherwise fall back to
  // sample. The "and non-empty" check matters because an empty CMS
  // returns [] not undefined — we want the fallback in either case.
  const instagramItems =
    instagramItemsProp && instagramItemsProp.length > 0
      ? instagramItemsProp
      : sampleInstagramItems;
  const reviewItems =
    reviewItemsProp && reviewItemsProp.length > 0
      ? reviewItemsProp
      : sampleReviewItems;

  return (
    <section
      aria-labelledby="gallery-heading"
      className="relative bg-bg"
    >
      <Container size="wide" className="pt-20 sm:pt-28 lg:pt-32">
        {/* Header */}
        <div className="mb-10 max-w-2xl sm:mb-14">
          <div className="flex items-center gap-3">
            <span aria-hidden className="block h-px w-12 bg-accent" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              From the Community
            </span>
          </div>
          <h2
            id="gallery-heading"
            className="mt-4 text-balance text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl"
          >
            Real games. Real reviews.
          </h2>
        </div>
      </Container>

      {/* === MOBILE/TABLET: two horizontal scroll rows === */}
      <div className="xl:hidden">
        <ScrollRow
          eyebrow="Latest from Instagram"
          viewAllHref="https://instagram.com/laseropsmalta"
          viewAllLabel="View all"
          items={instagramItems}
          renderItem={(item, key) => <InstagramCard key={key} item={item} mobileScroll />}
        />

        <div className="h-12 sm:h-16" aria-hidden />

        <ScrollRow
          eyebrow="What players say"
          viewAllHref="https://maps.google.com/?cid=laserops"
          viewAllLabel="All reviews"
          items={reviewItems}
          renderItem={(item, key) => <GoogleReviewCard key={key} item={item} mobileScroll />}
        />
      </div>

      {/* === DESKTOP: 3-col grid mixing both content types ===
          Interleave pattern: 2 IG, 1 review, repeat. Caps at 9 cells
          to keep the section a reasonable height regardless of how
          much CMS content exists. */}
      <Container size="wide" className="hidden xl:block">
        <div className="grid grid-cols-3 gap-4">
          {interleaveForGrid(instagramItems, reviewItems, 9).map((cell) =>
            cell.kind === "instagram" ? (
              <InstagramCard key={`ig-${cell.item.id}`} item={cell.item} />
            ) : (
              <GoogleReviewCard key={`gr-${cell.item.id}`} item={cell.item} />
            ),
          )}
        </div>
      </Container>

      {/* Footer CTAs */}
      <Container size="wide" className="pb-20 pt-12 sm:pb-28 sm:pt-16 lg:pb-32">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button
            href="https://instagram.com/laseropsmalta"
            target="_blank"
            rel="noopener noreferrer"
            variant="primary"
            size="md"
          >
            <InstagramIcon className="h-4 w-4" />
            Follow on Instagram
          </Button>
          <Button
            href="https://maps.google.com/?cid=laserops"
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            size="md"
          >
            <GoogleIcon className="h-4 w-4" />
            All reviews on Google
          </Button>
        </div>
      </Container>
    </section>
  );
}

// ============================================================
// Horizontal scrolling row container
// ============================================================
//
// Renders the items 3× in a continuous track, scroll-snap-center,
// and on mount scrolls to the middle copy. Result: user has many cards
// to swipe through in either direction before "hitting the end" — feels
// effectively infinite for normal swipe distances.
//
// Cards are 75vw wide; the track has 12.5vw padding on each side, so
// the focused card sits in the viewport center with prev/next cards
// peeking equally.

function ScrollRow<T extends { id: string }>({
  eyebrow,
  viewAllHref,
  viewAllLabel,
  items,
  renderItem,
}: {
  eyebrow: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  items: T[];
  renderItem: (item: T, key: string) => React.ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  // On mount, scroll the track to the middle copy so user has equal swipe
  // distance in both directions. We temporarily override scroll-behavior to
  // ensure this jump is instant (no visible animation on load).
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const id = window.requestAnimationFrame(() => {
      const prev = el.style.scrollBehavior;
      el.style.scrollBehavior = "auto";
      el.scrollLeft = el.scrollWidth / 3;
      // Restore on next frame so subsequent user scrolls use scroll-smooth.
      window.requestAnimationFrame(() => {
        el.style.scrollBehavior = prev;
      });
    });

    return () => window.cancelAnimationFrame(id);
  }, []);

  // 3× the items so user can swipe freely in either direction without
  // hitting an edge for a long time.
  const tripled: Array<{ item: T; key: string }> = [];
  for (let copy = 0; copy < 3; copy++) {
    for (const item of items) {
      tripled.push({ item, key: `${copy}-${item.id}` });
    }
  }

  return (
    <div>
      {/* Row header */}
      <Container size="wide" className="mb-4 flex items-baseline justify-between gap-4 sm:mb-5">
        <div className="flex items-center gap-3">
          <span aria-hidden className="block h-px w-8 bg-text-subtle" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            {eyebrow}
          </span>
        </div>
        {viewAllHref && viewAllLabel && (
          <Link
            href={viewAllHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted transition-colors hover:text-accent"
          >
            {viewAllLabel}
            <span aria-hidden className="ml-1">&rarr;</span>
          </Link>
        )}
      </Container>

      {/* Scroll track. Padding-x is 12.5vw so 75vw cards (the actual card
          width set via .gallery-card-w in CSS) center in the viewport with
          equal peek on both sides. snap-center for symmetric snap behavior. */}
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-3 sm:gap-4 [&::-webkit-scrollbar]:hidden"
        style={{
          scrollbarWidth: "none",
          paddingLeft: "12.5vw",
          paddingRight: "12.5vw",
        }}
      >
        {tripled.map(({ item, key }) => renderItem(item, key))}
      </div>
    </div>
  );
}

// ============================================================
// Card components
// ============================================================

function InstagramCard({
  item,
  mobileScroll = false,
}: {
  item: InstagramItem;
  mobileScroll?: boolean;
}) {
  return (
    <Link
      href={item.postUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group relative block aspect-square overflow-hidden bg-bg-elevated",
        // Mobile horizontal scroll: fixed-width card, snap-aligned
        mobileScroll && "w-[75vw] max-w-[420px] shrink-0 snap-center snap-always",
      )}
    >
      <Image
        src={item.imageSrc}
        alt={item.caption}
        width={800}
        height={800}
        sizes={
          mobileScroll
            ? "(min-width: 1280px) 33vw, 75vw"
            : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        }
        className="h-full w-full object-cover transition-transform duration-500 ease-[var(--ease-out-tactical)] group-hover:scale-105"
      />
      <div className="pointer-events-none absolute inset-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
        <p className="line-clamp-2 text-xs font-medium text-white/95">{item.caption}</p>
        <InstagramIcon className="h-5 w-5 shrink-0 text-white" />
      </div>
      <div className="pointer-events-none absolute right-3 top-3 transition-opacity duration-300 group-hover:opacity-0">
        <InstagramIcon className="h-5 w-5 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]" />
      </div>
    </Link>
  );
}

function GoogleReviewCard({
  item,
  mobileScroll = false,
}: {
  item: ReviewItem;
  mobileScroll?: boolean;
}) {
  return (
    <Link
      href={item.reviewsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        // Base: column layout, padding, hover state. Notably NO aspect ratio
        // here — review cards size to content by default.
        "group relative flex flex-col justify-between overflow-hidden border border-border bg-bg-elevated p-6 transition-colors duration-300 hover:border-border-strong sm:p-7",
        // Mobile horizontal scroll: fixed-width AND square so the card is
        // a clean tile in the swipe row, matching the IG cards alongside.
        // Square only applies in this mode — desktop cards grow to fit text.
        mobileScroll && "aspect-square w-[75vw] max-w-[420px] shrink-0 snap-center snap-always",
        // Desktop grid: minimum height matches the IG card's intrinsic
        // size (1fr column-width, ~aspect-square on a 3-col grid). Cards
        // grow taller for longer reviews; shorter reviews don't crater.
        // min-h is approximate — exact alignment with IG cards is not the
        // goal once we've decided to let reviews breathe.
        !mobileScroll && "min-h-[22rem] xl:min-h-[26rem]",
      )}
    >
      <div className="flex items-center gap-1" aria-label={`${item.rating} out of 5 stars`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <StarIcon
            key={i}
            className={cn(
              "h-4 w-4",
              i < item.rating ? "text-accent" : "text-border-strong",
            )}
          />
        ))}
      </div>
      <blockquote className="my-4 flex-1 overflow-hidden">
        {/* Mobile (square card): clamp to 6 lines so text fits without
            overflowing the square. Desktop: allow up to 14 lines —
            most reviews are shorter than this so they show in full;
            very long ones still get an ellipsis but with way more
            visible content. */}
        <p
          className={cn(
            "text-sm leading-relaxed text-text sm:text-base",
            mobileScroll ? "line-clamp-6" : "line-clamp-[14]",
          )}
        >
          &ldquo;{item.quote}&rdquo;
        </p>
      </blockquote>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text">{item.reviewer}</p>
          <p className="text-xs text-text-subtle">{item.relativeTime}</p>
        </div>
        <GoogleIcon className="h-5 w-5 shrink-0 text-text-muted transition-colors duration-300 group-hover:text-text" />
      </div>
    </Link>
  );
}

// ============================================================
// Interleave helper for the desktop grid
// ============================================================

type GridCell =
  | { kind: "instagram"; item: InstagramItem }
  | { kind: "review"; item: ReviewItem };

/**
 * Build a stable interleaved sequence for the desktop grid.
 *
 * Pattern: 2 instagram items, then 1 review, repeat. Falls back
 * gracefully when one stream is shorter than the other — uses whatever
 * stream still has items left. Caps at `maxCells` total to keep the
 * section a fixed visual height.
 *
 * Why hand-rolled rather than a clever zip: the desired interleave is
 * 2:1 (IG:review), not 1:1, and we want the pattern to keep going even
 * after one stream is exhausted. Easier to read as imperative code.
 */
function interleaveForGrid(
  instagram: InstagramItem[],
  reviews: ReviewItem[],
  maxCells: number,
): GridCell[] {
  const out: GridCell[] = [];
  let igIdx = 0;
  let revIdx = 0;
  let igConsumedSinceLastReview = 0;

  while (out.length < maxCells) {
    const moreInstagram = igIdx < instagram.length;
    const moreReviews = revIdx < reviews.length;
    if (!moreInstagram && !moreReviews) break;

    // Decide what kind of cell to emit next.
    // Prefer instagram unless we've already emitted 2 in a row, in which
    // case prefer a review. Fall through to whichever stream is non-empty.
    const wantReviewNext = igConsumedSinceLastReview >= 2;

    if (wantReviewNext && moreReviews) {
      out.push({ kind: "review", item: reviews[revIdx++] });
      igConsumedSinceLastReview = 0;
    } else if (moreInstagram) {
      out.push({ kind: "instagram", item: instagram[igIdx++] });
      igConsumedSinceLastReview++;
    } else if (moreReviews) {
      // Instagram exhausted, finish with reviews
      out.push({ kind: "review", item: reviews[revIdx++] });
    }
  }

  return out;
}



function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"
      />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2l2.95 6.7 7.05.7-5.34 4.95L18.27 22 12 18.4 5.73 22l1.61-7.65L2 9.4l7.05-.7z" />
    </svg>
  );
}
