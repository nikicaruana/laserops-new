"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type DuotoneImageProps = {
  /** Yellow/black/white branded version */
  brandedSrc: string;
  /** Full-color match photo */
  colorSrc: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  sizes?: string;
  className?: string;
  /** Disable interaction entirely — render exactly one variant. */
  staticVariant?: "branded" | "color";
  /** Which variant shows on touch devices (no hover capability). */
  mobileVariant?: "branded" | "color";
  /** CSS object-position value */
  objectPosition?: string;
  /**
   * Externally control the hover state. When provided, the component does NOT
   * track its own mouse events — the parent is responsible. Use this when the
   * hero (or other layered composition) needs hover detection on a parent
   * element because the image is covered by overlays.
   */
  forceState?: "branded" | "color";
};

/**
 * Renders both image treatments. By default tracks its own hover state.
 * When `forceState` is passed, the parent controls which variant shows.
 */
export function DuotoneImage({
  brandedSrc,
  colorSrc,
  alt,
  width,
  height,
  priority = false,
  sizes = "(max-width: 768px) 100vw, 50vw",
  className,
  staticVariant,
  mobileVariant = "color",
  objectPosition = "center",
  forceState,
}: DuotoneImageProps) {
  const [canHover, setCanHover] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const hoverQuery = window.matchMedia("(hover: hover)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setCanHover(hoverQuery.matches);
      setReducedMotion(motionQuery.matches);
    };
    update();
    hoverQuery.addEventListener("change", update);
    motionQuery.addEventListener("change", update);
    return () => {
      hoverQuery.removeEventListener("change", update);
      motionQuery.removeEventListener("change", update);
    };
  }, []);

  // Static variant — single image
  if (staticVariant) {
    const src = staticVariant === "branded" ? brandedSrc : colorSrc;
    return (
      <div className={cn("relative overflow-hidden", className)}>
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          sizes={sizes}
          className="h-full w-full object-cover"
          style={{ objectPosition }}
        />
      </div>
    );
  }

  // Determine which layer is visible.
  let showBranded: boolean;
  if (forceState) {
    // Parent is in control
    showBranded = forceState === "branded";
  } else if (reducedMotion) {
    showBranded = false;
  } else if (canHover) {
    showBranded = !isHovered;
  } else {
    showBranded = mobileVariant === "branded";
  }

  // Mouse tracking is only used when no forceState was provided
  const mouseProps = forceState
    ? {}
    : {
        onMouseEnter: () => setIsHovered(true),
        onMouseLeave: () => setIsHovered(false),
      };

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      {...mouseProps}
    >
      <Image
        src={colorSrc}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes={sizes}
        className="h-full w-full object-cover"
        style={{ objectPosition }}
      />

      <Image
        src={brandedSrc}
        alt=""
        aria-hidden
        width={width}
        height={height}
        sizes={sizes}
        className={cn(
          "absolute inset-0 h-full w-full object-cover",
          "transition-opacity duration-700 ease-[var(--ease-out-tactical)]",
          showBranded ? "opacity-100" : "opacity-0",
        )}
        style={{ objectPosition }}
      />
    </div>
  );
}
