"use client";

import { useEffect, useRef, useState } from "react";

/**
 * RatingPill
 * --------------------------------------------------------------------
 * Animated rating pill used by both ProfileCard (large) and StatCard
 * (small). On first scroll-into-view the icon counts up from 0-star →
 * the player's actual star level while spinning — all within 1.4 s.
 *
 * Animation is driven entirely via CSS (.rating-spinning, defined in
 * globals.css) so there are no layout shifts and the approach degrades
 * gracefully: prefers-reduced-motion skips straight to the final image,
 * and browsers without IntersectionObserver see the static final image
 * from the first render.
 *
 * Props:
 *   ratingImageUrl  — the Cloudinary/sheet URL for the player's rating.
 *                     Filename must contain "_N_Star" or "_N-Star" (0–4).
 *   pillClassName   — positioning + bg classes (caller controls size/place).
 *   imgClassName    — height / width classes (differs between card types).
 *   alt             — img alt text; pass "" for decorative images
 *                     (aria-hidden="true" is set automatically when "").
 */

/** Locally hosted rating images (public/ratings/).
 *  Index = star level (0–4). */
const RATING_IMAGES = [
  "/ratings/0-star.png",
  "/ratings/1-star.png",
  "/ratings/2-star.png",
  "/ratings/3-star.png",
  "/ratings/4-star.png",
] as const;

/**
 * Extract the numeric star level from a rating image URL.
 * Matches patterns like: _0_Star_, _1_Star_, _2-Star-Final etc.
 * Returns -1 when no match (treat as unknown → show static image).
 */
function starLevelFromUrl(url: string): number {
  if (!url) return -1;
  const m = url.match(/_(\d)[_-][Ss]tar/i);
  if (!m) return -1;
  return Math.min(4, Math.max(0, parseInt(m[1], 10)));
}

type RatingPillProps = {
  ratingImageUrl: string;
  pillClassName: string;
  imgClassName: string;
  alt?: string;
};

export function RatingPill({
  ratingImageUrl,
  pillClassName,
  imgClassName,
  alt = "",
}: RatingPillProps) {
  const target = starLevelFromUrl(ratingImageUrl);

  // currentStep drives which locally-hosted image is displayed.
  const [currentStep, setCurrentStep] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);

  const pillRef = useRef<HTMLDivElement>(null);
  // Prevent re-animation on re-renders; reset when URL (i.e. player) changes.
  const animatedRef = useRef(false);
  const prevUrlRef = useRef(ratingImageUrl);

  // Reset when a new player is loaded (ratingImageUrl changes).
  useEffect(() => {
    if (prevUrlRef.current !== ratingImageUrl) {
      prevUrlRef.current = ratingImageUrl;
      animatedRef.current = false;
      setCurrentStep(0);
      setIsSpinning(false);
    }
  }, [ratingImageUrl]);

  // Preload all 5 rating images once on mount so step transitions are instant.
  useEffect(() => {
    for (const src of RATING_IMAGES) {
      const img = new window.Image();
      img.src = src;
    }
  }, []);

  // IntersectionObserver: trigger the count-up animation on first view.
  useEffect(() => {
    // Nothing to count up for 0-star or unknown URLs.
    if (target <= 0) {
      setCurrentStep(Math.max(0, target));
      return;
    }

    const el = pillRef.current;
    if (!el) return;

    // Honour prefers-reduced-motion — jump straight to the final image.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCurrentStep(target);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry.isIntersecting || animatedRef.current) return;
        animatedRef.current = true;
        observer.disconnect();

        // Spread 1400 ms evenly across the number of steps.
        const stepMs = Math.floor(1400 / target);

        setIsSpinning(true);
        setCurrentStep(0);

        let step = 0;
        const tick = () => {
          step++;
          setCurrentStep(step);
          if (step >= target) {
            setIsSpinning(false);
          } else {
            setTimeout(tick, stepMs);
          }
        };

        setTimeout(tick, stepMs);
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  if (!ratingImageUrl) return null;

  // When target is -1 (unrecognised URL pattern), fall back to the raw URL.
  const imageSrc =
    target === -1
      ? ratingImageUrl
      : (RATING_IMAGES[currentStep] ?? RATING_IMAGES[0]);

  return (
    <div ref={pillRef} className={pillClassName}>
      <img
        src={imageSrc}
        alt={alt}
        aria-hidden={alt === "" ? true : undefined}
        loading="lazy"
        decoding="async"
        className={imgClassName + (isSpinning ? " rating-spinning" : "")}
      />
    </div>
  );
}
