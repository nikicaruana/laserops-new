"use client";

import { useState } from "react";
import Link from "next/link";
import { cldImage } from "@/lib/cld";
import type { WeaponAchievement } from "@/lib/leaderboards/player-achievements";
import { Placing } from "./Placing";

/**
 * WeaponAchievementsAccordion
 * --------------------------------------------------------------------
 * A grid of gun tiles (image + name) for the player's weapon achievements.
 * Tapping a gun expands a panel showing whether they're that gun's Weapon
 * Master plus their single-game record placings with it.
 */
export function WeaponAchievementsAccordion({ weapons }: { weapons: WeaponAchievement[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const current = weapons.find((w) => w.weaponName === selected) ?? null;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {weapons.map((w) => {
          const isOpen = current?.weaponName === w.weaponName;
          const count = w.items.length + (w.isMaster ? 1 : 0);
          return (
            <button
              key={w.weaponName}
              type="button"
              aria-expanded={isOpen}
              onClick={() => setSelected(isOpen ? null : w.weaponName)}
              className={`relative flex flex-col items-center gap-2 border p-2 transition-colors ${
                isOpen ? "border-accent" : "border-border hover:border-border-strong"
              }`}
            >
              {w.isMaster ? (
                <span
                  className="absolute right-1 top-1 z-[1] rounded-sm bg-accent px-1 py-0.5 text-[0.5rem] font-bold uppercase tracking-[0.08em] text-bg"
                  title="Weapon Master"
                >
                  Master
                </span>
              ) : null}
              <div className="flex h-16 w-full items-center justify-center bg-[#ffde00] sm:h-20">
                {w.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={cldImage(w.imageUrl, { w: 384 })}
                    alt={w.weaponName}
                    loading="lazy"
                    decoding="async"
                    className="h-12 w-auto object-contain sm:h-16"
                  />
                ) : null}
              </div>
              <span className="text-center text-[0.6rem] font-bold uppercase tracking-[0.06em] text-text sm:text-[0.7rem]">
                {w.weaponName}
              </span>
              <span className="text-[0.55rem] font-semibold uppercase tracking-[0.1em] text-text-subtle">
                {count} placing{count === 1 ? "" : "s"}
              </span>
            </button>
          );
        })}
      </div>

      {current ? (
        <div className="mt-4 border border-accent/50 bg-bg-elevated p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-base font-extrabold tracking-tight text-text sm:text-lg">{current.weaponName}</h4>
            <Link href={current.href} className="shrink-0 text-xs font-bold uppercase tracking-[0.1em] text-accent hover:text-accent-soft">
              View board →
            </Link>
          </div>

          {current.isMaster ? (
            <div className="mt-3 flex items-center gap-3 border border-accent bg-accent/[0.06] p-3">
              <Placing rank={1} />
              <div className="min-w-0">
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-accent">Weapon Master</p>
                {current.masterDetail ? <p className="mt-0.5 text-xs text-text-muted">{current.masterDetail}</p> : null}
              </div>
            </div>
          ) : null}

          {current.items.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {current.items.map((it, i) => (
                <li key={`${current.weaponName}-${i}`} className="flex items-center gap-3">
                  <Placing rank={it.rank} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text">{it.label}</p>
                    {it.detail ? <p className="truncate text-xs text-text-muted">{it.detail}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
