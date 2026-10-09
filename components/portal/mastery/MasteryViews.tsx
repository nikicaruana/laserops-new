/**
 * components/portal/mastery/MasteryViews.tsx
 * --------------------------------------------------------------------
 * Presentational pieces for Weapon Mastery, shared by the armory accordion and
 * the player-summary Mastery section. Earned badges show in full colour;
 * unearned ones (and unmet requirements) are greyed + desaturated.
 *
 * Requirements render as a TILE grid with big streak/accolade icons; each tile
 * is click/tap-able and opens the shared BadgeDetailDialog popup (same "what is
 * this?" popup used on the summary + match report).
 */
import { cldImage } from "@/lib/cld";
import { BadgeDetailDialog } from "@/components/portal/BadgeDetailDialog";
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
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-elevated/50 px-2 py-1">
      {earned.map((l) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={l.key}
          src={cldImage(l.badgeUrl, { w: 128 })}
          alt={`${l.label} mastery`}
          title={`${l.label} mastery`}
          loading="lazy"
          className="block h-12 w-12 object-contain sm:h-14 sm:w-14"
        />
      ))}
    </span>
  );
}

function CornerCheck() {
  return (
    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-bg bg-accent">
      <svg aria-hidden viewBox="0 0 16 16" className="h-3 w-3 text-bg" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
        <path d="M3 8.5l3.5 3.5L13 4" />
      </svg>
    </span>
  );
}

/** One requirement tile: big streak/accolade icon, click to open its popup. */
function ReqTile({ req }: { req: MasteryRequirement }) {
  return (
    <BadgeDetailDialog
      kind={req.kind === "streak" ? "Streak" : "Accolade"}
      name={req.label}
      description={req.description}
      badgeUrl={req.badgeUrl}
      footer={req.met ? "Earned with this gun" : "Not yet earned with this gun"}
      ariaLabel={`${req.label} - tap for details`}
      triggerClassName="h-full"
    >
      <div
        className={`flex h-full flex-col items-center gap-1.5 rounded-sm border p-2 text-center ${
          req.met ? "border-accent/40 bg-accent/5" : "border-border bg-bg-overlay/30"
        }`}
      >
        <div className="relative">
          {req.badgeUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cldImage(req.badgeUrl, { w: 192 })}
              alt=""
              aria-hidden
              loading="lazy"
              className={`block h-14 w-14 object-contain sm:h-16 sm:w-16 ${req.met ? "" : "opacity-40 grayscale"}`}
            />
          ) : (
            <span aria-hidden className="flex h-14 w-14 items-center justify-center text-2xl text-text-subtle sm:h-16 sm:w-16">
              &#9733;
            </span>
          )}
          {req.met && <CornerCheck />}
        </div>
        <span className={`text-[0.6rem] font-semibold leading-tight ${req.met ? "text-text" : "text-text-subtle"}`}>
          {req.label}
        </span>
      </div>
    </BadgeDetailDialog>
  );
}

/** One mastery level: badge + label header, then a tile grid of requirements. */
export function MasteryLevelBlock({ level }: { level: MasteryLevel }) {
  return (
    <div className={`rounded-sm border p-3 sm:p-4 ${level.earned ? "border-accent/50 bg-accent/5" : "border-border bg-bg-overlay/20"}`}>
      <div className="mb-3 flex items-center gap-3">
        <div className="w-14 shrink-0 sm:w-16">
          <MasteryBadgeImg url={level.badgeUrl} earned={level.earned} w={240} />
        </div>
        <div className="flex flex-1 items-center justify-between gap-2">
          <span className={`text-sm font-extrabold uppercase tracking-[0.14em] ${level.earned ? "text-accent" : "text-text"}`}>
            {level.label}
          </span>
          <span
            className={`rounded-sm px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.1em] ${
              level.earned ? "bg-accent text-bg" : "bg-bg-overlay text-text-subtle"
            }`}
          >
            {level.earned ? "Earned" : "Locked"}
          </span>
        </div>
      </div>
      {level.requirements.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {level.requirements.map((r, i) => (
            <ReqTile key={`${r.kind}-${r.label}-${i}`} req={r} />
          ))}
        </div>
      ) : (
        <p className="text-[0.65rem] italic text-text-subtle">No requirements configured.</p>
      )}
    </div>
  );
}

/** All four levels for one gun, stacked. */
export function MasteryLevels({ mastery }: { mastery: GunMastery }) {
  return (
    <div className="flex flex-col gap-3">
      {mastery.levels.map((l) => (
        <MasteryLevelBlock key={l.key} level={l} />
      ))}
    </div>
  );
}
