"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { DuotoneImage } from "@/components/ui/DuotoneImage";
import { ctaLinks } from "@/lib/nav";

/**
 * Home hero.
 *
 * MOBILE: Full-viewport composition with layered figure + background.
 *   - Background (yellow textured) fills the section
 *   - Figure (cutout PNG) anchored to bottom, sized to ~130% viewport width
 *     so it has prominent vertical presence
 *   - Headline + subhead positioned in the upper third of the viewport
 *   - CTAs anchored to bottom
 *
 * Color reveal: scroll-driven; completes after 8% of hero scrolled.
 *
 * DESKTOP (lg+): unchanged horizontal landscape hero with hover-driven duotone.
 */
export function HomeHero() {
  const [isHovered, setIsHovered] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const update = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const heroHeight = rect.height;
      const scrolledPast = -rect.top;
      const raw = scrolledPast / heroHeight;
      const adjusted = Math.max(0, Math.min(1, raw / 0.08));
      setScrollProgress(adjusted);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      // Section is content-driven on mobile/tablet (default) and on
      // large monitors (2xl). On xl (laptops, 1280-1535px wide) we
      // pin the aspect ratio to 16:9 — same as the hero image — so
      // the image renders at its natural framing instead of being
      // zoomed-in by object-cover when the section happens to be
      // shorter than 16:9 due to compact content.
      //
      // Without this constraint, on a typical laptop (~1500×800)
      // the section becomes content-height (~600-700px from the
      // pass-23 dialed-down content), giving the section a ~15:6
      // aspect against the image's 16:9. Object-cover compensates
      // by zooming the image vertically to fill — which scales the
      // figure up enormously and pushes their head out of frame.
      //
      // max-h prevents the 16:9 ratio from making the section
      // TALLER than the viewport on roomy xl widths (e.g. a 1500px
      // viewport at 16:9 → 844px section, slightly over an 800px
      // viewport). When the cap kicks in, aspect mismatch returns
      // but at most by ~5-10% — far less aggressive than the
      // unconstrained case and barely visible.
      //
      // 2xl restores `aspect-auto` so the original full-svh
      // behaviour kicks back in for big monitors where the
      // unconstrained section happens to be close to 16:9 anyway.
      className="relative isolate overflow-hidden xl:aspect-[16/9] xl:max-h-[calc(100svh-72px)] 2xl:aspect-auto 2xl:max-h-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ===================================================================
          MOBILE LAYERS (xl:hidden)
          =================================================================== */}

      {/* Layer 1: BACKGROUND yellow textured */}
      <div className="absolute inset-0 xl:hidden" aria-hidden>
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

      {/* Layer 2 + 3: FIGURE — anchored to bottom, height-capped via .hero-figure
          class which uses media queries to vary cap by viewport height:
          50vh on short phones (iPhone SE) so layout fits;
          60vh on taller phones for stronger figure presence. */}
      <div className="absolute inset-x-0 bottom-0 xl:hidden flex justify-center pointer-events-none" aria-hidden>
        <div className="hero-figure relative max-w-none">
          <Image
            src="/images/hero/hero-mobile-figure-color.png"
            alt=""
            width={1080}
            height={890}
            priority
            sizes="(max-height: 700px) 60vh, 70vh"
            className="block w-full h-auto"
          />
          <Image
            src="/images/hero/hero-mobile-figure-branded.png"
            alt=""
            width={1080}
            height={890}
            priority
            sizes="(max-height: 700px) 60vh, 70vh"
            className="absolute inset-0 block w-full h-auto"
            style={{
              opacity: 1 - scrollProgress,
              transition: "opacity 100ms linear",
            }}
          />
        </div>
      </div>

      {/* MOBILE SCRIM */}
      <div
        className="pointer-events-none absolute inset-0 xl:hidden"
        aria-hidden
        style={{
          background:
            "linear-gradient(180deg, rgba(10,10,10,0.88) 0%, rgba(10,10,10,0.72) 18%, rgba(10,10,10,0.45) 32%, rgba(10,10,10,0.05) 50%, rgba(10,10,10,0) 65%, rgba(10,10,10,0.55) 85%, rgba(10,10,10,0.92) 100%)",
        }}
      />

      {/* ===================================================================
          DESKTOP LAYERS (hidden xl:block)
          =================================================================== */}

      <div className="absolute inset-0 hidden xl:block" aria-hidden>
        <DuotoneImage
          brandedSrc="/images/hero/hero-01-branded.jpg"
          colorSrc="/images/hero/hero-01-color.jpg"
          alt=""
          width={1920}
          height={1080}
          priority
          sizes="100vw"
          // 80% center is the original framing — figure right of
          // centre, leaving the left ~30% as the yellow background
          // zone for the overlay text. Pass 25 changed this to "100%
          // center" to maximise the left zone, but that introduced
          // a visible black band on the right side of the section
          // on some laptop viewports (issue persisted across 2xl
          // monitors too). Reverted to 80% — it was working before
          // and the slight reduction in left-side empty space is
          // not worth the right-side artefact.
          objectPosition="80% center"
          forceState={isHovered ? "color" : "branded"}
          className="h-full w-full"
        />
      </div>

      <div
        className="pointer-events-none absolute inset-0 hidden xl:block"
        aria-hidden
        style={{
          background:
            "linear-gradient(90deg, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.78) 30%, rgba(10,10,10,0.25) 55%, rgba(10,10,10,0) 75%)",
        }}
      />

      {/* ===================================================================
          CONTENT
          =================================================================== */}

      <Container size="wide" className="relative z-10 xl:h-full">
        {/*
          MOBILE: text vertically centered within the yellow zone above the figure.
          The bottom-padding reserves space equal to the figure's visible height
          (figure is 130vw wide × 890/1080 aspect = ~107vw tall), so the flex
          centering ignores that area and centers text in what's left above.

          DESKTOP: vertically centered single content block, no figure-area
          reservation needed.
        */}
        <div className="hero-content flex min-h-[calc(100svh-72px)] flex-col items-stretch justify-center pt-6 sm:pt-10 xl:h-full xl:min-h-0 xl:py-10 2xl:min-h-[calc(100svh-72px)] 2xl:py-28">
          {/* DESKTOP CONTENT BLOCK — vertically centered with my-auto.
              Two desktop tiers:
                xl  (1280-1535px, typical laptop): content sized to fit
                                                    on a 13-15" screen
                                                    without scrolling.
                2xl (1536px+, monitors / big screens): the original
                                                       generous sizing
                                                       Niki designed against.
              The xl tier dials down: 5xl heading (was 7xl), md buttons
              (was lg), text-base paragraph (was lg), tighter stats. The
              2xl tier restores everything to the original sizing. */}
          <div className="hidden xl:block xl:my-auto max-w-[640px]">
            <h1 className="text-balance text-5xl font-extrabold leading-[1.02] 2xl:text-7xl">
              Outdoor Laser Tag in Malta.{" "}
              <span className="text-accent">Built for Competition.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-text-muted 2xl:mt-5 2xl:text-lg">
              Tactical missions, team battles, and competitive player stats — LaserOps is a new
              kind of laser tag experience.
            </p>
            <div className="mt-6 flex gap-3 2xl:mt-10 2xl:gap-4">
              <Button href={ctaLinks.primary.href} variant="primary" size="md">
                {ctaLinks.primary.label}
              </Button>
              <Button href={ctaLinks.secondary.href} variant="secondary" size="md">
                {ctaLinks.secondary.label}
              </Button>
            </div>
            <dl className="mt-10 grid max-w-xl grid-cols-3 gap-px border-y border-border bg-border 2xl:mt-16">
              {[
                { value: "12+", label: "Game Modes" },
                { value: "1000+", label: "Matches Played" },
                { value: "Outdoor", label: "Real Terrain" },
              ].map((stat) => (
                <div key={stat.label} className="bg-bg p-4 2xl:p-5">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
                    {stat.label}
                  </dt>
                  <dd className="mt-2 text-2xl font-bold text-text 2xl:text-3xl">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* MOBILE TEXT BLOCK — centered in the yellow zone above the figure */}
          <div className="max-w-2xl xl:hidden">
            <h1 className="text-balance text-4xl font-extrabold leading-[1.02] sm:text-5xl">
              Outdoor Laser Tag in Malta.{" "}
              <span className="text-accent">Built for Competition.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-white/80 sm:text-lg">
              Tactical missions, team battles, and competitive player stats — LaserOps is a new
              kind of laser tag experience.
            </p>
          </div>
        </div>
      </Container>

      {/* MOBILE CTAs — absolutely positioned at bottom of section, over figure */}
      <div className="absolute inset-x-0 bottom-0 z-20 xl:hidden">
        <Container size="wide">
          <div className="flex flex-col gap-2 pb-4">
            <Button href={ctaLinks.primary.href} variant="primary" size="md">
              {ctaLinks.primary.label}
            </Button>
            <Button href={ctaLinks.secondary.href} variant="secondary" size="md">
              {ctaLinks.secondary.label}
            </Button>
          </div>
        </Container>
      </div>
    </section>
  );
}
