"use client";

import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/**
 * Gallery section — mixed-content social proof grid.
 *
 * Renders a uniform-cell grid of two card types:
 *   - Instagram posts (image + IG icon + click-to-post)
 *   - Google reviews (quote + stars + reviewer name + click-to-Maps)
 *
 * All cards are square (aspect-1) for visual consistency. Grid is
 * responsive: 1 col narrow mobile, 2 col wider mobile/tablet, 3 col desktop.
 *
 * For now the data is hardcoded. In a follow-up session this will be
 * replaced by a Google Sheets-backed CMS so the user can update the
 * gallery without touching code.
 */

// === Sample data — to be replaced by Sheets fetch in next session ===
type GalleryItem =
  | {
      type: "instagram";
      id: string;
      imageSrc: string;
      caption: string;
      postUrl: string;
    }
  | {
      type: "google_review";
      id: string;
      rating: number; // 1-5
      quote: string;
      reviewer: string;
      relativeTime: string; // e.g. "3 weeks ago"
      reviewsUrl: string;
    };

const sampleItems: GalleryItem[] = [
  {
    type: "instagram",
    id: "ig1",
    imageSrc: "/images/gallery/action-1.jpg",
    caption: "Squad up. Match day at the quarry.",
    postUrl: "https://instagram.com/laseropsmalta",
  },
  {
    type: "google_review",
    id: "gr1",
    rating: 5,
    quote:
      "Honestly the best birthday party we've thrown for our 12-year-old. The team made it feel like a real military exercise.",
    reviewer: "Maria F.",
    relativeTime: "3 weeks ago",
    reviewsUrl: "https://maps.google.com/?cid=laserops",
  },
  {
    type: "instagram",
    id: "ig2",
    imageSrc: "/images/gallery/action-2.jpg",
    caption: "Capture the flag — final round chaos.",
    postUrl: "https://instagram.com/laseropsmalta",
  },
  {
    type: "instagram",
    id: "ig3",
    imageSrc: "/images/gallery/action-3.jpg",
    caption: "Sunset ops. Visibility low, intensity high.",
    postUrl: "https://instagram.com/laseropsmalta",
  },
  {
    type: "google_review",
    id: "gr2",
    rating: 5,
    quote:
      "Stag party absolutely loved it. Way more fun than expected. The outdoor terrain makes a huge difference vs indoor laser tag.",
    reviewer: "James C.",
    relativeTime: "1 month ago",
    reviewsUrl: "https://maps.google.com/?cid=laserops",
  },
  {
    type: "instagram",
    id: "ig4",
    imageSrc: "/images/gallery/action-4.jpg",
    caption: "When the squad rotates left flank.",
    postUrl: "https://instagram.com/laseropsmalta",
  },
  {
    type: "instagram",
    id: "ig5",
    imageSrc: "/images/gallery/action-5.jpg",
    caption: "Search & destroy. Last man standing wins.",
    postUrl: "https://instagram.com/laseropsmalta",
  },
  {
    type: "google_review",
    id: "gr3",
    rating: 5,
    quote:
      "Booked for our company team-building. Everyone was buzzing afterwards. Already planning the rematch.",
    reviewer: "Sandra K.",
    relativeTime: "2 months ago",
    reviewsUrl: "https://maps.google.com/?cid=laserops",
  },
  {
    type: "instagram",
    id: "ig6",
    imageSrc: "/images/gallery/action-6.jpg",
    caption: "Real weapons, real terrain, real tactics.",
    postUrl: "https://instagram.com/laseropsmalta",
  },
];

export function GallerySection() {
  return (
    <section
      aria-labelledby="gallery-heading"
      className="relative bg-bg"
    >
      <Container size="wide" className="py-20 sm:py-28 lg:py-32">
        {/* Header */}
        <div className="mb-12 max-w-2xl sm:mb-16">
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

        {/* Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {sampleItems.map((item) =>
            item.type === "instagram" ? (
              <InstagramCard key={item.id} item={item} />
            ) : (
              <GoogleReviewCard key={item.id} item={item} />
            ),
          )}
        </div>

        {/* Footer CTAs */}
        <div className="mt-12 flex flex-col items-center gap-4 sm:mt-16 sm:flex-row sm:justify-center">
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
// Card components
// ============================================================

function InstagramCard({
  item,
}: {
  item: Extract<GalleryItem, { type: "instagram" }>;
}) {
  return (
    <Link
      href={item.postUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block aspect-square overflow-hidden bg-bg-elevated"
    >
      <Image
        src={item.imageSrc}
        alt={item.caption}
        width={800}
        height={800}
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        className="h-full w-full object-cover transition-transform duration-500 ease-[var(--ease-out-tactical)] group-hover:scale-105"
      />
      {/* Overlay — visible on hover (desktop) and always faintly on touch */}
      <div className="pointer-events-none absolute inset-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
        <p className="line-clamp-2 text-xs font-medium text-white/95">{item.caption}</p>
        <InstagramIcon className="h-5 w-5 shrink-0 text-white" />
      </div>
      {/* Always-visible IG icon in corner — small subtle indicator */}
      <div className="pointer-events-none absolute right-3 top-3 transition-opacity duration-300 group-hover:opacity-0">
        <InstagramIcon className="h-5 w-5 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]" />
      </div>
    </Link>
  );
}

function GoogleReviewCard({
  item,
}: {
  item: Extract<GalleryItem, { type: "google_review" }>;
}) {
  return (
    <Link
      href={item.reviewsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex aspect-square flex-col justify-between overflow-hidden border border-border bg-bg-elevated p-6 transition-colors duration-300 hover:border-border-strong sm:p-7"
    >
      {/* Top: stars */}
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

      {/* Middle: quote */}
      <blockquote className="my-4 flex-1 overflow-hidden">
        <p className="line-clamp-6 text-sm leading-relaxed text-text sm:text-base">
          &ldquo;{item.quote}&rdquo;
        </p>
      </blockquote>

      {/* Bottom: attribution */}
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
// Inline icons — small enough to keep here rather than a library
// ============================================================

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
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"
      />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M12 2l2.95 6.7 7.05.7-5.34 4.95L18.27 22 12 18.4 5.73 22l1.61-7.65L2 9.4l7.05-.7z" />
    </svg>
  );
}
