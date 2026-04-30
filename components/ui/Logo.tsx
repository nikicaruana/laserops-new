import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

type LogoProps = {
  /** "icon" = crosshair only (header). "wordmark" = full lockup (hero, footer). */
  variant?: "icon" | "wordmark";
  /** Color treatment for the asset. Yellow only available for the icon variant. */
  color?: "white" | "black" | "yellow";
  /** Visual size — tuned per variant. */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Wrap in a link to home (default true) */
  asLink?: boolean;
  className?: string;
};

/**
 * Size tables per variant.
 * Icon is square — sizes are pixel height/width.
 * Wordmark is wide — sizes drive width and height auto-scales (~5.5:1 ratio).
 */
const sizeMap = {
  icon: {
    sm: 28,
    md: 36,
    lg: 48,
    xl: 64,
  },
  wordmark: {
    xs: 130,
    sm: 160,
    md: 220,
    lg: 280,
    xl: 360,
  },
} as const;

export function Logo({
  variant = "icon",
  color = "white",
  size = "md",
  asLink = true,
  className,
}: LogoProps) {
  // Both icon and wordmark variants now have yellow assets.
  const src =
    variant === "icon"
      ? `/brand/laserops-icon-${color}.png`
      : `/brand/laserops-logo-${color}.png`;

  const dimensions = (() => {
    if (variant === "icon") {
      // Icon doesn't have an xs size — fall back to sm
      const iconSize = size === "xs" ? "sm" : size;
      const s = sizeMap.icon[iconSize];
      return { displayW: s, naturalW: 256, naturalH: 256 };
    }
    const w = sizeMap.wordmark[size];
    return { displayW: w, naturalW: 800, naturalH: 145 };
  })();

  const altText =
    variant === "icon" ? "LaserOps" : "LaserOps — Tactical Laser Tag";

  const img = (
    <Image
      src={src}
      alt={altText}
      width={dimensions.naturalW}
      height={dimensions.naturalH}
      priority
      className={cn("h-auto select-none", className)}
      style={{ width: `${dimensions.displayW}px` }}
    />
  );

  if (!asLink) return img;

  return (
    <Link
      href="/"
      aria-label="LaserOps Malta — Home"
      className="inline-flex items-center transition-opacity hover:opacity-80"
    >
      {img}
    </Link>
  );
}
