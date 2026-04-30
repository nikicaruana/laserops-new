"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { DuotoneImage } from "@/components/ui/DuotoneImage";
import { ctaLinks } from "@/lib/nav";

/**
 * Home hero — scroll-driven morph on mobile.
 *
 * MOBILE (< lg):
 *   The hero has TWO conceptual frames:
 *
 *   Frame A (initial, scroll progress 0):
 *     - Headline lower in the viewport (~25% from top)
 *     - Figure large, taking up most of the vertical space
 *     - CTAs at the very bottom
 *
 *   Frame B (collapsed, scroll progress 1):
 *     - Headline at top
 *     - Figure compressed to a smaller area
 *     - CTAs visible above the figure's lower portion
 *     - Layout is tight; weapons section starts peeking in below
 *
 *   The hero is rendered inside an outer container that is 1.6x viewport
 *   height. The hero itself is sticky-positioned, pinning to the top of
 *   the viewport while the user scrolls through the outer container's
 *   "extra" space. During this scroll, we interpolate layout properties
 *   from Frame A to Frame B.
 *
 *   Once the user has scrolled past the outer container, the sticky pin
 *   releases and they continue into the next section.
 *
 *   Color reveal: tied to morph progress. Same scroll = same reveal.
 *
 * DESKTOP (lg+):
 *   No morph. Standard hero with hover-driven duotone, vertically centered
 *   content, full landscape backdrop.
 */
export function HomeHero() {
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(0); // 0 = Frame A, 1 = Frame B
  const outerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const el = outerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollableDistance = rect.height - window.innerHeight;
      if (scrollableDistance <= 0) {
        setProgress(0);
        return;
      }
      const scrolled = -rect.top;
      const raw = scrolled / scrollableDistance;
      setProgress(Math.max(0, Math.min(1, raw)));
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // Linear interpolation helper
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  // ===== Mobile interpolated values =====
  // Headline top spacer: starts at 18% down from top, ends at 0% (top of section)
  const headlineTopPct = lerp(18, 0, progress);
  // Figure scale: from 1.3 (large) to 0.85 (tight). transform-origin: bottom center
  // means scaling happens UP from the bottom — figure's feet stay planted.
  const figureScale = lerp(1.3, 0.85, progress);
  // Color reveal driven by progress
  const brandedOpacity = 1 - progress;

  return (
    <>
      {/* MOBILE outer container: 1.6x viewport tall, provides scroll distance for the morph */}
      <div
        ref={outerRef}
        className="relative lg:hidden"
        style={{ height: "calc(130dvh - 72px)" }}
      >
        {/* Sticky inner — pinned to top of viewport while parent scrolls.
            Fixed height = full viewport minus header. */}
        <section
          className="sticky top-[72px] h-[calc(100dvh-72px)] overflow-hidden"
          aria-label="Hero"
        >
          {/* BACKGROUND — yellow textured, fixed */}
          <div className="absolute inset-0" aria-hidden>
            <Image
              src="/images/hero/hero-mobile-bg.png"
              alt=""
              width={1080}
              height={1620}
              priority
              sizes="100vw"
              className="h-full w-full object-cover"
            />
          </div>

          {/*
            FIGURE — anchored to bottom-0 always. Only the scale animates.
            transform-origin: bottom center means scale shrinks the figure
            UPWARD from a fixed bottom edge — feet stay planted.
          */}
          <div
            className="absolute inset-x-0 bottom-0 flex justify-center pointer-events-none"
            aria-hidden
            style={{
              transform: `scale(${figureScale})`,
              transformOrigin: "bottom center",
            }}
          >
            <div className="relative w-full">
              <Image
                src="/images/hero/hero-mobile-figure-color.png"
                alt=""
                width={1080}
                height={890}
                priority
                sizes="130vw"
                className="block w-full h-auto"
              />
              <Image
                src="/images/hero/hero-mobile-figure-branded.png"
                alt=""
                width={1080}
                height={890}
                priority
                sizes="130vw"
                className="absolute inset-0 block w-full h-auto"
                style={{ opacity: brandedOpacity }}
              />
            </div>
          </div>

          {/* SCRIM — vertical gradient for text/CTA legibility */}
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden
            style={{
              background:
                "linear-gradient(180deg, rgba(10,10,10,0.9) 0%, rgba(10,10,10,0.72) 18%, rgba(10,10,10,0.4) 32%, rgba(10,10,10,0.05) 50%, rgba(10,10,10,0) 65%, rgba(10,10,10,0.55) 85%, rgba(10,10,10,0.95) 100%)",
            }}
          />

          {/* CONTENT — headline, subhead, CTAs */}
          <Container size="wide" className="relative z-10 h-full">
            <div className="flex h-full flex-col">
              {/* Top spacer — pushes headline down per progress */}
              <div style={{ height: `${headlineTopPct}%` }} aria-hidden />

              {/* Headline + subhead */}
              <div className="max-w-2xl">
                <h1 className="text-balance text-4xl font-extrabold leading-[1.02] sm:text-5xl">
                  Outdoor Laser Tag in Malta.{" "}
                  <span className="text-accent">Built for Competition.</span>
                </h1>
                <p className="mt-5 max-w-xl text-base text-white/80 sm:text-lg">
                  Tactical missions, team battles, and competitive player stats — LaserOps is a
                  new kind of laser tag experience.
                </p>
              </div>

              {/* Spacer to push CTAs to bottom */}
              <div className="flex-1" aria-hidden />

              {/* CTAs — anchored to bottom of section with consistent padding */}
              <div className="flex flex-col gap-2.5 pb-6">
                <Button href={ctaLinks.primary.href} variant="primary" size="md">
                  {ctaLinks.primary.label}
                </Button>
                <Button href={ctaLinks.secondary.href} variant="secondary" size="md">
                  {ctaLinks.secondary.label}
                </Button>
              </div>
            </div>
          </Container>
        </section>
      </div>

      {/* DESKTOP hero — unchanged from previous version */}
      <section
        className="relative isolate hidden overflow-hidden lg:block"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="absolute inset-0" aria-hidden>
          <DuotoneImage
            brandedSrc="/images/hero/hero-01-branded.jpg"
            colorSrc="/images/hero/hero-01-color.jpg"
            alt=""
            width={1920}
            height={1080}
            priority
            sizes="100vw"
            objectPosition="80% center"
            forceState={isHovered ? "color" : "branded"}
            className="h-full w-full"
          />
        </div>

        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "linear-gradient(90deg, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.78) 30%, rgba(10,10,10,0.25) 55%, rgba(10,10,10,0) 75%)",
          }}
        />

        <Container size="wide" className="relative z-10">
          <div className="flex min-h-[760px] flex-col py-28">
            <div className="my-auto max-w-[640px]">
              <h1 className="text-balance text-7xl font-extrabold leading-[1.02]">
                Outdoor Laser Tag in Malta.{" "}
                <span className="text-accent">Built for Competition.</span>
              </h1>
              <p className="mt-5 max-w-xl text-text-muted text-lg">
                Tactical missions, team battles, and competitive player stats — LaserOps is a new
                kind of laser tag experience.
              </p>
              <div className="mt-10 flex gap-4">
                <Button href={ctaLinks.primary.href} variant="primary" size="lg">
                  {ctaLinks.primary.label}
                </Button>
                <Button href={ctaLinks.secondary.href} variant="secondary" size="lg">
                  {ctaLinks.secondary.label}
                </Button>
              </div>
              <dl className="mt-16 grid max-w-xl grid-cols-3 gap-px border-y border-border bg-border">
                {[
                  { value: "12+", label: "Game Modes" },
                  { value: "1000+", label: "Matches Played" },
                  { value: "Outdoor", label: "Real Terrain" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-bg p-5">
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
                      {stat.label}
                    </dt>
                    <dd className="mt-2 text-3xl font-bold text-text">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
