import { cn } from "@/lib/cn";

/**
 * FavouriteWeaponCard — bottom card of the top section's right column.
 *
 * Visual: yellow tile holds the weapon silhouette image (gun art is dark/
 * black so needs a light backdrop to "pop" — same treatment used in the
 * Looker reference design). Below the tile, the weapon's name centered.
 *
 * Renders a placeholder hint if the player has no Favourite_Gun set yet
 * — better than showing an empty yellow box.
 */

type FavouriteWeaponCardProps = {
  /** Weapon name, e.g. "AK-25 Predator". Empty if none yet. */
  weaponName: string;
  /** URL to the weapon silhouette image. Empty if none. */
  imageUrl: string;
};

export function FavouriteWeaponCard({
  weaponName,
  imageUrl,
}: FavouriteWeaponCardProps) {
  const hasWeapon = weaponName !== "" && imageUrl !== "";

  return (
    <div className="flex flex-col gap-3 border border-border bg-bg-elevated p-4 sm:p-6">
      <div className="text-center text-[0.65rem] font-bold uppercase tracking-[0.14em] text-text-muted">
        Favourite Weapon
      </div>

      {/* Yellow tile housing the weapon image. The dark silhouette art needs
          a light backdrop to read clearly — yellow aligns with brand and
          matches the Looker reference. */}
      <div
        className={cn(
          "flex items-center justify-center bg-accent",
          // Generous interior padding so the silhouette doesn't crowd the edges.
          "px-4 py-6 sm:px-6 sm:py-8",
          // Tile height bumped — gives the gun art more presence and matches
          // the importance of the weapon as the visual centerpiece of this card.
          "min-h-[180px] sm:min-h-[220px]",
        )}
      >
        {hasWeapon ? (
          <img
            src={imageUrl}
            alt={weaponName}
            loading="lazy"
            decoding="async"
            // Object-contain preserves aspect ratio. No max-width cap so the
            // gun fills the available width of the tile (object-contain still
            // prevents distortion). max-h-full keeps it from blowing past the
            // tile height on tall guns.
            className="h-full max-h-full w-full object-contain"
          />
        ) : (
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-bg/70">
            Not yet earned
          </span>
        )}
      </div>

      {hasWeapon ? (
        <div className="text-center text-base font-bold tracking-tight text-text sm:text-lg">
          {weaponName}
        </div>
      ) : (
        <div className="text-center text-sm text-text-subtle">
          Play more matches to earn one
        </div>
      )}
    </div>
  );
}
