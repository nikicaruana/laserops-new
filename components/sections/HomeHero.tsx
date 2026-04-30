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
      className="relative isolate overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ===================================================================
          MOBILE LAYERS (lg:hidden)
          =================================================================== */}

      {/* Layer 1: BACKGROUND yellow textured */}
      <div className="absolute inset-0 lg:hidden" aria-hidden>
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

      {/* Layer 2 + 3: FIGURE — anchored to bottom, sized 130vw for prominence */}
      <div className="absolute inset-x-0 bottom-0 lg:hidden flex justify-center" aria-hidden>
        <div className="relative w-[130%] max-w-none">
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
            style={{
              opacity: 1 - scrollProgress,
              transition: "opacity 100ms linear",
            }}
          />
        </div>
      </div>

      {/* MOBILE SCRIM */}
      <div
        className="pointer-events-none absolute inset-0 lg:hidden"
        aria-hidden
        style={{
          background:
            "linear-gradient(180deg, rgba(10,10,10,0.88) 0%, rgba(10,10,10,0.72) 18%, rgba(10,10,10,0.45) 32%, rgba(10,10,10,0.05) 50%, rgba(10,10,10,0) 65%, rgba(10,10,10,0.55) 85%, rgba(10,10,10,0.92) 100%)",
        }}
      />

      {/* ===================================================================
          DESKTOP LAYERS (hidden lg:block)
          =================================================================== */}

      <div className="absolute inset-0 hidden lg:block" aria-hidden>
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
        className="pointer-events-none absolute inset-0 hidden lg:block"
        aria-hidden
        style={{
          background:
            "linear-gradient(90deg, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.78) 30%, rgba(10,10,10,0.25) 55%, rgba(10,10,10,0) 75%)",
        }}
      />

      {/* ===================================================================
          CONTENT
          =================================================================== */}

      <Container size="wide" className="relative z-10">
        {/*
          MOBILE: full viewport (minus header). Text block sits in the upper
          third with breathing room above (8% spacer) so it's not crammed
          against the header. CTAs anchored at bottom.

          DESKTOP: vertically centered single content block.
        */}
        <div className="flex min-h-[calc(100dvh-72px)] flex-col py-6 sm:py-10 lg:py-28">
          {/* Top breathing space (mobile only) — gives the headline visual margin
              from the sticky header without anchoring it to the very top. */}
          <div className="h-[8%] lg:hidden" aria-hidden />

          {/* Text block */}
          <div className="lg:my-auto max-w-2xl lg:max-w-[640px]">
            <h1 className="text-balance text-4xl font-extrabold leading-[1.02] sm:text-5xl lg:text-7xl">
              Outdoor Laser Tag in Malta.{" "}
              <span className="text-accent">Built for Competition.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-white/80 sm:text-lg lg:text-text-muted">
              Tactical missions, team battles, and competitive player stats — LaserOps is a new
              kind of laser tag experience.
            </p>

            {/* DESKTOP CTAs inline */}
            <div className="mt-10 hidden flex-col gap-3 sm:flex-row sm:gap-4 lg:flex">
              <Button href={ctaLinks.primary.href} variant="primary" size="lg">
                {ctaLinks.primary.label}
              </Button>
              <Button href={ctaLinks.secondary.href} variant="secondary" size="lg">
                {ctaLinks.secondary.label}
              </Button>
            </div>

            {/* HUD stat strip — desktop only */}
            <dl className="mt-12 hidden max-w-xl grid-cols-3 gap-px border-y border-border bg-border sm:mt-16 lg:grid">
              {[
                { value: "12+", label: "Game Modes" },
                { value: "1000+", label: "Matches Played" },
                { value: "Outdoor", label: "Real Terrain" },
              ].map((stat) => (
                <div key={stat.label} className="bg-bg p-4 sm:p-5">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
                    {stat.label}
                  </dt>
                  <dd className="mt-2 text-2xl font-bold text-text sm:text-3xl">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* MOBILE: spacer pushes CTAs to the bottom */}
          <div className="flex-1 lg:hidden" aria-hidden />

          {/* MOBILE CTAs anchored at bottom */}
          <div className="flex flex-col gap-2.5 lg:hidden">
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
  );
}
