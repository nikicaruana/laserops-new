import { cloudinaryTransform } from "@/lib/cloudinary";

/**
 * WeaponCarousel
 * --------------------------------------------------------------------
 * A continuous, auto-scrolling marquee of individual gun images on the
 * brand yellow band — used as a visual teaser for the full weapons page.
 *
 * Pure CSS animation (no client JS): two identical strips sit in a
 * `w-max` flex row and the track translates from 0 → -50% (one strip
 * width) on a linear loop, so the second strip seamlessly takes over
 * where the first began. Reuses the shared `weapons-scroll-left`
 * keyframe (see app/globals.css) via the `.weapon-carousel-track` class,
 * which also pauses on hover and disables under prefers-reduced-motion.
 *
 * Gun images are designed to sit on yellow (same as the /weapons strip
 * and the armory cards), hence the #ffde00 band.
 *
 * Images are routed through cloudinaryTransform to cap height + serve
 * WebP/AVIF; non-Cloudinary URLs pass through untouched.
 * --------------------------------------------------------------------
 */

type Gun = { src: string; name: string };

const IMG_TRANSFORM = "h_200,c_fit,q_auto,f_auto";

export function WeaponCarousel({ guns }: { guns: Gun[] }) {
  if (guns.length === 0) return null;

  const optimized = guns.map((g) => ({
    name: g.name,
    src: cloudinaryTransform(g.src, IMG_TRANSFORM),
  }));

  return (
    <div
      className="weapon-carousel relative overflow-hidden rounded-sm"
      style={{ backgroundColor: "#ffde00" }}
      role="group"
      aria-label="A selection of the laser tag weapons available at LaserOps"
    >
      <div className="weapon-carousel-track flex w-max items-center will-change-transform">
        <WeaponStripCopy guns={optimized} />
        <WeaponStripCopy guns={optimized} aria-hidden />
      </div>

      {/* Edge fades so guns ease in/out at the band edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-10 sm:w-20"
        style={{ background: "linear-gradient(to right, #ffde00 0%, transparent 100%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-10 sm:w-20"
        style={{ background: "linear-gradient(to left, #ffde00 0%, transparent 100%)" }}
      />
    </div>
  );
}

/**
 * One copy of the gun strip. Two of these stacked side by side form the
 * seamless loop. The cloned copy is passed aria-hidden so screen readers
 * and SEO crawlers don't see every gun name twice.
 */
function WeaponStripCopy({
  guns,
  "aria-hidden": ariaHidden,
}: {
  guns: Gun[];
  "aria-hidden"?: boolean;
}) {
  return (
    <div
      aria-hidden={ariaHidden}
      className="flex shrink-0 items-center gap-6 px-3 py-5 sm:gap-10 sm:py-6"
    >
      {guns.map((gun, i) => (
        <img
          key={`${gun.name}-${i}`}
          src={gun.src}
          alt={ariaHidden ? "" : gun.name}
          loading="lazy"
          draggable={false}
          className="block h-12 w-auto max-w-none select-none object-contain sm:h-16 lg:h-20"
        />
      ))}
    </div>
  );
}
