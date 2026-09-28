"use client";

/**
 * components/portal/awards/AwardCard.tsx
 * --------------------------------------------------------------------
 * One accolade/streak card for the public Streaks & Accolades page: badge, name,
 * tier tag, what it's for, and the XP / points it awards. Tapping the badge opens
 * a larger preview (the shared Modal) with the full-size art + details.
 */
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { cldImage } from "@/lib/cld";

export type AwardCardData = {
  name: string;
  description: string | null;
  badge_url: string | null;
  xp: number | null;
  points: number | null;
  /** Tier number (streaks have their own; accolades derive one from XP). */
  tier?: number | null;
};

export function AwardCard({ a }: { a: AwardCardData }) {
  const [open, setOpen] = useState(false);
  const xp = Number(a.xp ?? 0);
  const pts = Number(a.points ?? 0);
  const thumb = a.badge_url ? cldImage(a.badge_url, { w: 240, trim: true }) : "";
  const big = a.badge_url ? cldImage(a.badge_url, { w: 640, trim: true }) : "";
  const tierTag = a.tier ? `Tier ${a.tier}` : null;

  const reward = (
    <>
      {xp > 0 && <span className="text-[0.7rem] font-bold uppercase tracking-[0.06em] text-accent">+{xp} XP</span>}
      {pts > 0 && <span className="text-[0.7rem] font-bold uppercase tracking-[0.06em] text-accent">+{pts} pts</span>}
    </>
  );

  return (
    <div className="flex gap-4 portal-card p-5">
      {thumb ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Enlarge ${a.name} badge`}
          className="shrink-0 rounded-md transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt={a.name} className="h-20 w-20 object-contain sm:h-24 sm:w-24" />
        </button>
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center border border-border text-text-subtle sm:h-24 sm:w-24" aria-hidden>
          ★
        </div>
      )}

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-text">{a.name}</h3>
          {tierTag && (
            <span className="border border-border px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.1em] text-text-subtle">
              {tierTag}
            </span>
          )}
        </div>
        {a.description && <p className="mt-1 text-xs leading-relaxed text-text-muted">{a.description}</p>}
        {(xp > 0 || pts > 0) && <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">{reward}</div>}
      </div>

      {open && big && (
        <Modal title={a.name} onClose={() => setOpen(false)}>
          <div className="flex flex-col items-center gap-4 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={big} alt={a.name} className="h-40 w-40 object-contain sm:h-48 sm:w-48" />
            {tierTag && (
              <span className="border border-border px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-text-subtle">
                {tierTag}
              </span>
            )}
            {a.description && <p className="text-sm leading-relaxed text-text-muted">{a.description}</p>}
            {(xp > 0 || pts > 0) && <div className="flex items-center gap-3">{reward}</div>}
          </div>
        </Modal>
      )}
    </div>
  );
}
