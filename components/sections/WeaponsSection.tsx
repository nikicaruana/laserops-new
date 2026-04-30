"use client";

import Image from "next/image";
import { useState } from "react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

/**
 * Weapons preview section.
 *
 * Four horizontal rows of weapons on a yellow background. Each row scrolls
 * continuously with a different direction, speed, and starting offset so that
 * no two rows ever show the same weapon in the same horizontal position
 * simultaneously. A CTA button sits overlaid in the center.
 *
 * DUOTONE BEHAVIOR:
 *   - Branded (BW) by default
 *   - Desktop: hover anywhere reveals color (cross-fade)
 *   - Mobile: touch-and-hold reveals color, release returns to BW
 *
 * IMPLEMENTATION NOTES:
 *   - Each row contains TWO copies of the strip in a flex container with
 *     `width: max-content`. This forces the container to size to the natural
 *     sum of children's widths (not parent width), so translateX(-50%) maps
 *     to exactly one strip width — perfect seamless loop.
 *   - Negative animation-delay values stagger each row's starting position
 *     without waiting (CSS treats a -10s delay as "start as if you've been
 *     running for 10 seconds").
 *   - Both color and branded strips are stacked inside the same animated
 *     container, guaranteeing they stay in sync regardless of timing drift.
 */
export function WeaponsSection() {
  // Branded (BW) by default. Color reveals on:
  //   - Desktop: mouse hover anywhere in the section
  //   - Mobile: touch (tap-and-hold) anywhere in the section
  // Touch interaction mirrors the user's request for "drag" — finger contact
  // reveals color, releasing returns to BW.
  const [isActive, setIsActive] = useState(false);

  const brandedOpacity = isActive ? 0 : 1;

  return (
    <section
      aria-labelledby="weapons-heading"
      className="relative overflow-hidden"
      style={{ backgroundColor: "#ffde00" }}
    >
      {/* Subtle dot texture echoing the hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 50%, rgba(0,0,0,0.4) 1px, transparent 1.5px), radial-gradient(circle at 70% 30%, rgba(0,0,0,0.3) 1px, transparent 1.5px)",
          backgroundSize: "32px 32px, 48px 48px",
        }}
      />

      <Container size="wide" className="relative py-20 sm:py-28 lg:py-32">
        {/* Eyebrow + heading */}
        <div className="mb-12 max-w-2xl sm:mb-16">
          <div className="flex items-center gap-3">
            <span aria-hidden className="block h-px w-12 bg-bg" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-bg">
              Arsenal
            </span>
          </div>
          <h2
            id="weapons-heading"
            className="mt-4 text-balance text-4xl font-extrabold leading-[1.02] text-bg sm:text-5xl lg:text-6xl"
          >
            15+ tactical weapons.{" "}
            <span className="block sm:inline">Pick your loadout.</span>
          </h2>
        </div>

        {/* Animated rows + overlaid CTA.
            Interaction zone is THIS container (not the whole section), so
            hovering the heading or empty section padding does NOT trigger
            the color reveal. Only contact with the weapons strip does. */}
        <div
          className="relative"
          onMouseEnter={() => setIsActive(true)}
          onMouseLeave={() => setIsActive(false)}
          onTouchStart={() => setIsActive(true)}
          onTouchEnd={() => setIsActive(false)}
          onTouchCancel={() => setIsActive(false)}
        >
          <Rows brandedOpacity={brandedOpacity} />

          {/* OVERLAID CTA — centered, just the button */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="pointer-events-auto">
              <Button
                href="/weapons"
                variant="primary"
                size="lg"
                className="bg-bg text-accent hover:bg-bg-elevated"
              >
                View All Weapons
              </Button>
            </div>
          </div>

          {/* Edge fades — narrower on mobile so they don't encroach on the CTA */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-10 sm:w-24 lg:w-40"
            style={{
              background: "linear-gradient(to right, #ffde00 0%, transparent 100%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-10 sm:w-24 lg:w-40"
            style={{
              background: "linear-gradient(to left, #ffde00 0%, transparent 100%)",
            }}
          />
        </div>
      </Container>
    </section>
  );
}

/**
 * Five rows. Each has unique direction + duration + delay.
 * Negative delays offset starting positions so weapons never align across rows.
 */
function Rows({ brandedOpacity }: { brandedOpacity: number }) {
  const rows: Array<{
    direction: "left" | "right";
    durationSeconds: number;
    delaySeconds: number;
  }> = [
    { direction: "left", durationSeconds: 60, delaySeconds: 0 },
    { direction: "right", durationSeconds: 78, delaySeconds: -18 },
    { direction: "left", durationSeconds: 54, delaySeconds: -8 },
    { direction: "right", durationSeconds: 72, delaySeconds: -30 },
  ];

  return (
    <div className="flex flex-col gap-3 sm:gap-3.5 lg:gap-4">
      {rows.map((row, i) => (
        <Row
          key={i}
          direction={row.direction}
          durationSeconds={row.durationSeconds}
          delaySeconds={row.delaySeconds}
          brandedOpacity={brandedOpacity}
        />
      ))}
    </div>
  );
}

function Row({
  direction,
  durationSeconds,
  delaySeconds,
  brandedOpacity,
}: {
  direction: "left" | "right";
  durationSeconds: number;
  delaySeconds: number;
  brandedOpacity: number;
}) {
  return (
    <div className="relative w-full overflow-hidden h-[88px] sm:h-[104px] lg:h-[120px]">
      <div
        className="relative flex h-full will-change-transform"
        style={{
          width: "max-content",
          animation: `weapons-scroll-${direction} ${durationSeconds}s linear infinite`,
          animationDelay: `${delaySeconds}s`,
        }}
      >
        <StripCopy brandedOpacity={brandedOpacity} />
        <StripCopy brandedOpacity={brandedOpacity} />
      </div>
    </div>
  );
}

function StripCopy({ brandedOpacity }: { brandedOpacity: number }) {
  return (
    <div className="relative h-full shrink-0">
      <Image
        src="/images/weapons/weapons-strip-color.png"
        alt=""
        width={8438}
        height={240}
        priority={false}
        className="h-full w-auto select-none"
        draggable={false}
        style={{ display: "block" }}
      />
      <Image
        src="/images/weapons/weapons-strip-branded.png"
        alt=""
        aria-hidden
        width={8438}
        height={240}
        priority={false}
        className="absolute inset-0 h-full w-auto select-none"
        draggable={false}
        style={{
          display: "block",
          opacity: brandedOpacity,
          transition: "opacity 400ms ease-out",
        }}
      />
    </div>
  );
}
