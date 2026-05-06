"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
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

      {/* Layer 1: BACKGROUND — yellow textured fill, always full-bleed */}
      <div className="absolute inset-0 hidden xl:block" aria-hidden>
        <Image
          src="/images/hero/desktop-hero-01-bg.png"
          alt=""
          width={2400}
          height={1350}
          priority
          sizes="100vw"
          className="h-full w-full object-cover"
        />
      </div>

      {/* Layer 2 + 3: FIGURE — transparent PNG pair, right-anchored.
          Container spans full height and sticks to the right edge.
          h-full w-auto on the images scales them to the section height
          while letting width be proportional — figure is never cropped.
          Any left-side overflow sits behind the text/scrim area. */}
      <div className="absolute inset-y-0 right-0 hidden xl:flex items-end pointer-events-none" aria-hidden>
        <div className="relative h-full">
          <Image
            src="/images/hero/desktop-hero-01-figure-color.png"
            alt=""
            width={2400}
            height={1350}
            priority
            sizes="(min-width: 1280px) 100vw"
            className="block h-full w-auto max-w-none"
          />
          <Image
            src="/images/hero/desktop-hero-01-figure-branded.png"
            alt=""
            width={2400}
            height={1350}
            priority
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
              Malta's Ultimate Outdoor Laser Tag Experience.{" "}
              <span className="text-accent">Built for Competition.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-text-muted 2xl:mt-5 2xl:text-lg">
              Tactical missions, different scenarios, and Malta's only persistent stat and
              progressive unlock system — LaserOps is changing the game.
            </p>
            <a
              href="https://www.google.com/search?sa=X&sca_esv=2139bdf85252c619&sxsrf=ANbL-n7BBFIoyEmF9EGMnPohOASsuflb1g:1778084247753&q=LaserOps+Reviews&rflfq=1&num=20&stick=H4sIAAAAAAAAAONgkxIxNDU3MjI2NjA1tjAwNDExsADiDYyMrxgFfBKLU4v8C4oVglLLMlPLixexYggBAKXHTuxBAAAA&rldimm=15722330538014408440&tbm=lcl&hl=en-MT&ved=2ahUKEwib997_h6WUAxVLR_4FHcGCPEQQ9fQKegQIVRAG&biw=1718&bih=1318&dpr=1#lkt=LocalPoiReviews"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-text 2xl:mt-5"
            >
              <span className="text-base leading-none text-yellow-400">★★★★★</span>
              <span className="font-semibold text-text">5.0</span>
              <span>on Google Reviews</span>
            </a>
            <div className="mt-6 flex gap-3 2xl:mt-8 2xl:gap-4">
              <Button href={ctaLinks.primary.href} variant="primary" size="md">
                {ctaLinks.primary.label}
              </Button>
              <Button href={ctaLinks.secondary.href} variant="secondary" size="md">
                {ctaLinks.secondary.label}
              </Button>
            </div>
            <dl className="mt-10 grid max-w-xl grid-cols-3 gap-px border-y border-border bg-border 2xl:mt-16">
              {[
                { value: "15+", label: "Weapons" },
                { value: "6+", label: "Game Modes" },
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
              Malta's Ultimate Outdoor Laser Tag Experience.{" "}
              <span className="text-accent">Built for Competition.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-white/80 sm:text-lg">
              Tactical missions, different scenarios, and Malta's only persistent stat and
              progressive unlock system — LaserOps is changing the game.
            </p>
            <a
              href="https://www.google.com/search?sa=X&sca_esv=2139bdf85252c619&sxsrf=ANbL-n7BBFIoyEmF9EGMnPohOASsuflb1g:1778084247753&q=LaserOps+Reviews&rflfq=1&num=20&stick=H4sIAAAAAAAAAONgkxIxNDU3MjI2NjA1tjAwNDExsADiDYyMrxgFfBKLU4v8C4oVglLLMlPLixexYggBAKXHTuxBAAAA&rldimm=15722330538014408440&tbm=lcl&hl=en-MT&ved=2ahUKEwib997_h6WUAxVLR_4FHcGCPEQQ9fQKegQIVRAG&biw=1718&bih=1318&dpr=1#lkt=LocalPoiReviews"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-white"
            >
              <span className="text-base leading-none text-yellow-400">★★★★★</span>
              <span className="font-semibold text-white">5.0</span>
              <span>on Google Reviews</span>
            </a>
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
