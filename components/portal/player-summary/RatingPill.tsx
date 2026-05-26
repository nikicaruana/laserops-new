"use client";

import { useEffect, useRef, useState } from "react";

/**
 * RatingPill — animated rating display.
 *
 * Renders 5 individual circular icons in a 3+2 grid (matching the original
 * PNG layout). On first scroll-into-view, icons count up from 0 → the
 * player's actual rating, with each active icon spinning individually as
 * it lights up. Total animation ≤ 1.4 s. Respects prefers-reduced-motion.
 */

const ICON_ACTIVE        = "/ratings/icon-active.png";
/** Red variant used for all 5 icons when the player has a 5-star rating. */
const ICON_ACTIVE_5STAR  = "/ratings/icon-active-5star.png";
const ICON_INACTIVE      = "/ratings/icon-inactive.png";

/**
 * Extract star level (0–4) from a rating image URL.
 * Matches _0_Star, _1_Star, _2-Star etc.  Returns -1 on no match.
 */
function starLevelFromUrl(url: string): number {
  if (!url) return -1;
  const m = url.match(/_(\d)[_-][Ss]tar/i);
  if (!m) return -1;
  return Math.min(5, Math.max(0, parseInt(m[1], 10)));
}

type RatingPillProps = {
  ratingImageUrl: string;
  pillClassName: string;
  /** Applied to each individual icon <img>.  Controls size (e.g. "h-4 w-auto"). */
  iconImgClassName: string;
  alt?: string;
};

export function RatingPill({
  ratingImageUrl,
  pillClassName,
  iconImgClassName,
  alt = "",
}: RatingPillProps) {
  const target = starLevelFromUrl(ratingImageUrl);

  // activeCount = how many icons are currently yellow
  const [activeCount, setActiveCount] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);

  const pillRef    = useRef<HTMLDivElement>(null);
  const animated   = useRef(false);
  const prevUrlRef = useRef(ratingImageUrl);

  // Reset when a new player is loaded
  useEffect(() => {
    if (prevUrlRef.current !== ratingImageUrl) {
      prevUrlRef.current = ratingImageUrl;
      animated.current   = false;
      setActiveCount(0);
      setIsSpinning(false);
    }
  }, [ratingImageUrl]);

  // Preload all icon assets once
  useEffect(() => {
    for (const src of [ICON_ACTIVE, ICON_ACTIVE_5STAR, ICON_INACTIVE]) {
      const img = new window.Image();
      img.src = src;
    }
  }, []);

  // IntersectionObserver → trigger count-up animation on first view
  useEffect(() => {
    // 0-star: nothing to count up, just show the inactive grid
    if (target <= 0) {
      setActiveCount(0);
      return;
    }

    const el = pillRef.current;
    if (!el) return;

    // Skip animation for reduced-motion users
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setActiveCount(target);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || animated.current) return;
        animated.current = true;
        observer.disconnect();

        // Spread 1400 ms evenly across steps
        const stepMs = Math.floor(1400 / target);

        setIsSpinning(true);
        setActiveCount(0);

        let count = 0;
        const tick = () => {
          count++;
          setActiveCount(count);
          if (count >= target) {
            // Give the final icon one extra beat before stopping the spin
            setTimeout(() => setIsSpinning(false), stepMs * 0.6);
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

  // Fallback: if the URL doesn't match the expected pattern, show the raw image
  if (target === -1) {
    return (
      <div ref={pillRef} className={pillClassName}>
        <img
          src={ratingImageUrl}
          alt={alt}
          aria-hidden={alt === "" ? true : undefined}
          loading="lazy"
          decoding="async"
          className={iconImgClassName}
        />
      </div>
    );
  }

  // For 5-star players, all icons use the red variant.
  // During the animation the correct colour appears as each icon lights up.
  const activeIcon = target === 5 ? ICON_ACTIVE_5STAR : ICON_ACTIVE;

  // Render 5 icons: 0-4. Icons < activeCount are active, rest dark.
  // Active icons spin while isSpinning is true.
  const renderIcon = (index: number) => {
    const isActive = index < activeCount;
    return (
      <img
        key={index}
        src={isActive ? activeIcon : ICON_INACTIVE}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        className={
          iconImgClassName + (isActive && isSpinning ? " rating-spinning" : "")
        }
      />
    );
  };

  return (
    <div ref={pillRef} className={pillClassName}>
      {/* 3+2 grid matching the original PNG layout */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex gap-1">
          {[0, 1, 2].map(renderIcon)}
        </div>
        <div className="flex gap-1">
          {[3, 4].map(renderIcon)}
        </div>
      </div>
    </div>
  );
}
