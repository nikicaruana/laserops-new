/**
 * components/portal/mastery/MasteryViews.tsx
 * --------------------------------------------------------------------
 * Presentational pieces for Weapon Mastery, shared by the armory accordion and
 * the player-summary Mastery section. Pure (no hooks) so they render on the
 * server or inside a client component. Earned badges show in full colour;
 * unearned ones (and unmet requirements) are greyed + desaturated.
 */
import { cldImage } from "@/lib/cld";
import type { GunMastery, MasteryLevel, MasteryRequirement } from "@/lib/weapons/mastery";

/** A mastery badge image, greyed when not earned. */
export function MasteryBadgeImg({
  url,
  earned,
  className,
  w = 320,
}: {
  url: string | null;
  earned: boolean;
  className?: string;
  w?: number;
}) {
  if (!url) {
    return (
      <span aria-hidden className={`flex items-center justify-center text-2xl text-text-subtle ${className ?? ""}`}>
        &#9733;
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={cldImage(url, { w })}
      alt=""
      aria-hidden
      loading="lazy"
      decoding="async"
      className={`block h-auto w-full object-contain ${earned ? "" : "opacity-40 grayscale"} ${className ?? ""}`}
    />
  );
}

/** Collapsed-header badges: the mastery levels already earned, or a coming-soon pill. */
export function MasteryPreview({ mastery }: { mastery: GunMastery | undefined }) {
  if (!mastery || mastery.comingSoon) {
    return (
      <span className="rounded-sm border border-border px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-[0.12em] text-text-subtle">
        Mastery coming soon
      </span>
    );
  }
  const earned = mastery.levels.filter((l) => l.earned && l.badgeUrl);
  if (earned.length === 0) return null;
  return (
    <span className="flex items-center gap-1">
      {earned.map((l) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={l.key}
          src={cldImage(l.badgeUrl, { w: 96 })}
          alt={`${l.label} mastery`}
          title={`${l.label} mastery`}
          loading="lazy"
          className="block h-7 w-7 object-contain sm:h-8 sm:w-8"
        />
      ))}
    </span>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
      <path d="M3 8.5l3.5 3.5L13 4" />
    </svg>
  );
}

/** One requirement (a streak or accolade to earn with the gun), greyed if unmet. */
function ReqChip({ req }: { req: MasteryRequirement }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-sm border px-2 py-1.5 ${
        req.met ? "border-accent/40 bg-accent/5" : "border-border bg-bg-overlay/30 opacity-55"
      }`}
    >
      {req.badgeUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cldImage(req.badgeUrl, { w: 64 })}
          alt=""
          aria-hidden
          loading="lazy"
          className={`block h-6 w-6 shrink-0 object-contain ${req.met ? "" : "grayscale"}`}
        />
      )}
      <span className="min-w-0 flex-1 truncate text-[0.65rem] font-semibold text-text" title={req.label}>
        {req.label}
      </span>
      {req.met && <CheckIcon />}
    </div>
  );
}

/** One mastery level: big badge + its requirements, with earned/locked state. */
export function MasteryLevelBlock({ level }: { level: MasteryLevel }) {
  return (
    <div className={`flex gap-3 rounded-sm border p-3 ${level.earned ? "border-accent/50 bg-accent/5" : "border-border bg-bg-overlay/30"}`}>
      <div className="flex w-16 shrink-0 flex-col items-center gap-1 sm:w-20">
        <MasteryBadgeImg url={level.badgeUrl} earned={level.earned} w={200} />
        <span className={`text-[0.55rem] font-bold uppercase tracking-[0.1em] ${level.earned ? "text-accent" : "text-text-subtle"}`}>
          {level.label}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[0.55rem] font-bold uppercase tracking-[0.14em] text-text-muted">Requirements</span>
          <span
            className={`rounded-sm px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-[0.1em] ${
              level.earned ? "bg-accent text-bg" : "bg-bg-overlay text-text-subtle"
            }`}
          >
            {level.earned ? "Earned" : "Locked"}
          </span>
        </div>
        {level.requirements.length > 0 ? (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {level.requirements.map((r, i) => (
              <ReqChip key={`${r.kind}-${r.label}-${i}`} req={r} />
            ))}
          </div>
        ) : (
          <p className="text-[0.65rem] italic text-text-subtle">No requirements configured.</p>
        )}
      </div>
    </div>
  );
}

/** All four levels for one gun, stacked. */
export function MasteryLevels({ mastery }: { mastery: GunMastery }) {
  return (
    <div className="flex flex-col gap-2.5">
      {mastery.levels.map((l) => (
        <MasteryLevelBlock key={l.key} level={l} />
      ))}
    </div>
  );
}
