"use client";

import { useEffect, useRef, useState } from "react";
import type { WeaponRecords } from "@/lib/leaderboards/hall-of-fame";
import { RecordList } from "./RecordList";

/**
 * Weapon Masters — a grid of weapon thumbnails. Tapping one opens a
 * detail panel below the grid showing the current Weapon Master
 * (highest career score with the gun) and its single-game records.
 */
export function WeaponMastersSection({
  weapons,
}: {
  weapons: WeaponRecords[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const current = weapons.find((w) => w.weaponName === selected) ?? null;

  // Scroll the detail panel into view when a weapon is opened.
  const detailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selected]);

  if (weapons.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-text-muted">
        Weapon records will appear here once match data is available.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-5 text-center text-sm text-text-muted">
        Tap a weapon to see its master and single-game records.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {weapons.map((w) => {
          const isOpen = current?.weaponName === w.weaponName;
          return (
            <button
              key={w.weaponName}
              type="button"
              aria-expanded={isOpen}
              onClick={() => setSelected(isOpen ? null : w.weaponName)}
              className={`flex flex-col items-center gap-2 border p-2 transition-colors ${
                isOpen
                  ? "border-accent"
                  : "border-border hover:border-border-strong"
              }`}
            >
              <div className="flex h-16 w-full items-center justify-center bg-[#ffde00] sm:h-20">
                {w.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={w.imageUrl}
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
            </button>
          );
        })}
      </div>

      {current ? (
        <div
          ref={detailRef}
          className="mt-5 scroll-mt-24 border border-accent/50 bg-bg-elevated p-4 sm:p-6"
        >
          <h3 className="text-lg font-extrabold tracking-tight sm:text-xl">
            {current.weaponName}
          </h3>

          {current.master ? (
            <div className="mt-3 flex items-center gap-4 border border-accent bg-accent/[0.06] p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.master.profilePicUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-14 w-14 shrink-0 rounded-sm border border-border-strong object-cover sm:h-16 sm:w-16"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-accent">
                  Weapon Master
                </p>
                <a
                  href={`/player-portal/player-stats/summary?ops=${encodeURIComponent(current.master.nickname)}`}
                  className="block truncate font-mono text-sm font-bold text-text transition-colors hover:text-accent sm:text-base"
                >
                  {current.master.nickname}
                </a>
                <p className="mt-0.5 leading-tight">
                  <span className="font-mono text-base font-bold tabular-nums text-accent">
                    {current.master.formatted}
                  </span>{" "}
                  <span className="text-xs text-text-muted">total score</span>
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {current.categories.map((c) => (
              <RecordList
                key={c.key}
                label={c.label}
                note={c.note}
                entries={c.entries}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
