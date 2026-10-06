/**
 * components/portal/player-summary/MasterySection.tsx
 * --------------------------------------------------------------------
 * Weapon Mastery badges for the Player Summary, below Streaks. One card per
 * gun showing its Bronze/Silver/Gold/Platinum badges - earned in colour,
 * not-yet-earned greyed out (same treatment as the streaks + accolades).
 */
import { cldImage } from "@/lib/cld";
import type { GunMastery } from "@/lib/weapons/mastery";

export function MasterySection({ guns }: { guns: GunMastery[] }) {
  if (guns.length === 0) {
    return <p className="text-sm text-text-subtle">No weapon mastery configured yet.</p>;
  }
  const totalEarned = guns.reduce((s, g) => s + g.earnedLevels.length, 0);

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex items-baseline justify-center gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Mastery Badges</span>
        <span className="font-mono text-2xl font-extrabold tabular-nums text-accent sm:text-3xl">
          {totalEarned.toLocaleString("en-US")}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {guns.map((g) => (
          <div key={g.gunName} className="flex flex-col gap-3 portal-card p-3 sm:p-4">
            <span className="text-sm font-extrabold uppercase tracking-[0.1em] text-text">{g.gunName}</span>
            <div className="grid grid-cols-4 gap-2">
              {g.levels.map((l) => (
                <div key={l.key} className="flex flex-col items-center gap-1 text-center">
                  {l.badgeUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cldImage(l.badgeUrl, { w: 200 })}
                      alt={`${l.label} mastery for ${g.gunName}`}
                      loading="lazy"
                      decoding="async"
                      className={`block h-auto w-full max-w-[5rem] object-contain ${l.earned ? "" : "opacity-40 grayscale"}`}
                    />
                  ) : (
                    <div className="flex aspect-square w-full max-w-[5rem] items-center justify-center text-2xl text-text-subtle">&#9733;</div>
                  )}
                  <span className={`text-[0.55rem] font-bold uppercase tracking-[0.08em] ${l.earned ? "text-accent" : "text-text-subtle"}`}>
                    {l.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
