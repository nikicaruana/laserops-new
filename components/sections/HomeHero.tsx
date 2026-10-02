"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { DEFAULT_HOME_HERO, type HomeHeroConfig } from "@/lib/cms/home-config";

/**
 * Home hero.
 *
 * Content (headline, subhead, Google-reviews badge, the two CTAs, stat tiles)
 * is CMS-driven from home_config (edited at /admin/homepage) and passed in as
 * `config`. Falls back to DEFAULT_HOME_HERO so the component is safe to render
 * standalone. Layout/animation is unchanged from the original hardcoded hero.
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
export function HomeHero({ config = DEFAULT_HOME_HERO }: { config?: HomeHeroConfig }) {
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

  // Google-reviews badge (star rating + link). Shared markup for both breakpoints.
  const reviewsBadge = (className: string) => (
    <a
      href={config.reviewsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      <span className="text-base leading-none text-yellow-400">★★★★★</span>
      <span className="font-semibold text-text">{config.rating}</span>
      <span>{config.reviewsLabel}</span>
    </a>
  );

  return (
    <section
      ref={sectionRef}
      // Section is content-driven on mobile/tablet (default) and on
      // large monitors (2xl). On xl (laptops, 1280-1535px wide) we
      // pin the aspect ratio to 16:9 – same as the hero image – so
      // the image renders at its natural framing instead of being
      // zoomed-in by object-cover when the section happens to be
      // shorter than 16:9 due to compact content.
      className="relative isolate overflow-hidden xl:bg-[#ffde00] xl:min-h-[calc(100svh-72px)]"
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
          sizes="100vw"
          className="h-full w-full object-cover"
        />
      </div>

      {/* Layer 2 + 3: FIGURE – anchored to bottom, height-capped via .hero-figure
          class which uses media queries to vary cap by viewport height. */}
      <div className="absolute inset-x-0 bottom-0 xl:hidden flex justify-center pointer-events-none" aria-hidden>
        <div className="hero-figure relative max-w-none">
          <Image
            src="/images/hero/hero-mobile-figure-color.png"
            alt=""
            width={1080}
            height={890}
            sizes="(max-height: 700px) 60vh, 70vh"
            className="block w-full h-auto"
          />
          <Image
            src="/images/hero/hero-mobile-figure-branded.png"
            alt=""
            width={1080}
            height={890}
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

      {/* Layer 1: BACKGROUND – yellow textured fill, always full-bleed */}
      <div className="absolute inset-0 hidden xl:block" aria-hidden>
        <Image
          src="/images/hero/desktop-hero-01-bg.png"
          alt=""
          width={2400}
          height={1350}
          sizes="100vw"
          className="h-full w-full object-cover"
        />
      </div>

      {/* Layer 2 + 3: FIGURE – transparent PNG pair, right-anchored. */}
      <div className="absolute inset-y-0 right-0 hidden xl:flex items-end pointer-events-none" aria-hidden>
        <div className="relative h-full">
          <Image
            src="/images/hero/desktop-hero-01-figure-color.png"
            alt=""
            width={2400}
            height={1350}
            sizes="(min-width: 1280px) 100vw"
            className="block h-full w-auto max-w-none"
          />
          <Image
            src="/images/hero/desktop-hero-01-figure-branded.png"
            alt=""
            width={2400}
            height={1350}
            sizes="(min-width: 1280px) 100vw"
            className="absolute inset-0 block h-full w-auto max-w-none"
            style={{
              opacity: isHovered ? 0 : 1,
              transition: "opacity 400ms ease",
            }}
          />
        </div>
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
        <div className="hero-content flex h-[calc(100svh-72px)] flex-col items-stretch pt-8 sm:pt-12 xl:h-full xl:min-h-0 xl:py-10 2xl:min-h-[calc(100svh-72px)] 2xl:py-28">
          {/* DESKTOP CONTENT BLOCK – vertically centered with my-auto. */}
          <div className="hidden xl:block xl:my-auto max-w-[640px]">
            <h1 className="text-balance text-5xl font-extrabold leading-[1.02] 2xl:text-7xl">
              {config.lead}{" "}
              <span className="text-accent">{config.highlight}</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-text-muted 2xl:mt-5 2xl:text-lg">
              {config.subhead}
            </p>
            {reviewsBadge(
              "mt-4 inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-text 2xl:mt-5",
            )}
            <div className="mt-6 flex gap-3 2xl:mt-8 2xl:gap-4">
              <Button href={config.ctaPrimaryHref} variant="primary" size="md">
                {config.ctaPrimaryLabel}
              </Button>
              <Button href={config.ctaSecondaryHref} variant="secondary" size="md">
                {config.ctaSecondaryLabel}
              </Button>
            </div>
            {config.stats.length > 0 && (
              <dl
                className="mt-10 grid max-w-xl gap-px border-y border-border bg-border 2xl:mt-16"
                style={{ gridTemplateColumns: `repeat(${config.stats.length}, minmax(0, 1fr))` }}
              >
                {config.stats.map((stat) => (
                  <div key={stat.label} className="bg-bg p-4 2xl:p-5">
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
                      {stat.label}
                    </dt>
                    <dd className="mt-2 text-2xl font-bold text-text 2xl:text-3xl">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {/* MOBILE TEXT BLOCK – centered in the yellow zone above the figure */}
          <div className="max-w-2xl xl:hidden">
            <h1 className="text-balance text-4xl font-extrabold leading-[1.02] sm:text-5xl">
              {config.lead}{" "}
              <span className="text-accent">{config.highlight}</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-white/80 sm:text-lg">
              {config.subhead}
            </p>
            {reviewsBadge(
              "mt-4 inline-flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-white bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm",
            )}
          </div>
        </div>
      </Container>

      {/* MOBILE CTAs – absolutely positioned at bottom of section, over figure */}
      <div className="absolute inset-x-0 bottom-0 z-20 xl:hidden">
        <Container size="wide">
          <div className="flex flex-col gap-2 pb-4">
            <Button href={config.ctaPrimaryHref} variant="primary" size="md">
              {config.ctaPrimaryLabel}
            </Button>
            <Button href={config.ctaSecondaryHref} variant="secondary" size="md">
              {config.ctaSecondaryLabel}
            </Button>
          </div>
        </Container>
      </div>
    </section>
  );
}
