"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatFireRate } from "@/lib/cms/weapons";
import type { ArmoryEntry } from "@/lib/weapons/armory";
import type { GunMastery } from "@/lib/weapons/mastery";
import { AnimatedNumber } from "@/components/match-report/AnimatedNumber";
import { AnimatedProgressBar } from "./AnimatedProgressBar";
import { MasteryPreview, MasteryLevels } from "@/components/portal/mastery/MasteryViews";

/**
 * ArmoryCard
 * --------------------------------------------------------------------
 * One gun on the Armory page, as an ACCORDION (was a tile + popup):
 *
 *   Collapsed header (always visible): gun image, name, the summarized stat
 *   strip (K/D, Acc, Kills, Matches) or locked-unlock progress, plus the
 *   mastery badges already earned with this gun (or a "coming soon" pill).
 *
 *   Expanded body: the full stats in a cleaner layout, then a Weapon Mastery
 *   subsection with every level's requirements - greyed out where the player
 *   hasn't earned them yet (and the mastery badge greyed with them).
 */

type Props = {
  entry: ArmoryEntry;
  mastery?: GunMastery;
};

export function ArmoryCard({ entry, mastery }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [inView, setInView] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const isLocked = !entry.gunIsUnlocked;
  const imageSrc =
    entry.gunPlayerImage ||
    (isLocked ? entry.gunLockedImg : "") ||
    entry.gunUsedImg ||
    entry.spec?.imageUrl ||
    "";

  // Animate the locked progress bar / count-up once when the card scrolls in.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            obs.disconnect();
            break;
          }
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const showCountUp = isLocked && entry.unlockReqPoints > 0;
  const title = isLocked ? entry.unlockDisplayText || "Locked" : entry.gunDisplayTitle || entry.gunName;

  return (
    <div ref={cardRef} className="overflow-hidden rounded-sm portal-card transition-colors">
      {/* ── Accordion header (toggles) ──────────────────────────── */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          "group flex w-full flex-col text-left transition-colors",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-accent",
          "lg:flex-row",
        )}
      >
        {/* Image band */}
        <div
          className="flex h-28 shrink-0 items-center justify-center px-3 sm:h-32 lg:h-auto lg:w-60 lg:self-stretch"
          style={{ backgroundColor: "#ffde00" }}
        >
          {imageSrc !== "" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt={isLocked ? "" : entry.gunName}
              aria-hidden={isLocked || undefined}
              className={cn("block h-20 w-auto select-none object-contain sm:h-24 lg:h-36", isLocked && "opacity-60 blur-[6px]")}
              draggable={false}
            />
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-1.5 p-4 sm:p-5 lg:justify-center">
          <div className="flex items-center justify-between gap-2">
            {entry.treeBranch !== "" ? (
              <span className="text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-accent">{entry.treeBranch}</span>
            ) : <span />}
            <span className="flex items-center gap-2">
              {isLocked ? (
                <span className="rounded-sm border border-border-strong px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.14em] text-text-muted">Locked</span>
              ) : !entry.hasUsedGun ? (
                <span className="rounded-sm border border-border px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.14em] text-text-muted">Unused</span>
              ) : null}
              {/* Expand chevron */}
              <svg
                aria-hidden
                viewBox="0 0 12 12"
                className={cn("h-3 w-3 shrink-0 text-accent transition-transform duration-200", expanded && "rotate-90")}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 2l4 4-4 4" strokeLinecap="square" />
              </svg>
            </span>
          </div>

          {/* Title + earned mastery badges alongside the name */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 lg:justify-start">
            <h3 className="text-xl font-extrabold leading-tight tracking-tight text-text sm:text-2xl">{title}</h3>
            <MasteryPreview mastery={mastery} />
          </div>

          {/* Preview content */}
          {isLocked ? (
            <div className="mt-1">
              <AnimatedProgressBar pct={entry.unlockProgressPct} play={inView} />
              <p className="mt-2 text-center text-sm text-text-muted lg:text-left">
                {showCountUp ? (
                  <>
                    <AnimatedNumber
                      key={`${entry.gunName}-${inView ? "play" : "idle"}`}
                      value={inView ? entry.pointsTowardUnlock : 0}
                      format="comma"
                      duration={2000}
                    />
                    {" / "}
                    {entry.unlockReqPoints.toLocaleString("en-US")} XP
                  </>
                ) : (
                  entry.unlockProgressText
                )}
              </p>
            </div>
          ) : entry.hasUsedGun ? (
            <div className="mt-1 grid grid-cols-4 gap-2">
              <MiniStat label="K/D" value={fmtFloat(entry.kdRatio)} />
              <MiniStat label="Acc." value={fmtPct(entry.avgAccuracy)} />
              <MiniStat label="Kills" value={fmtNum(entry.killsTotal)} />
              <MiniStat label="Matches" value={fmtNum(entry.matchesUsed)} />
            </div>
          ) : (
            <p className="mt-1 text-center text-sm italic text-text-muted lg:text-left">Unlocked but never used. Expand for details.</p>
          )}
        </div>
      </button>

      {/* ── Expanded body ──────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-border p-4 sm:p-5">
          <ArmoryDetailBody entry={entry} isLocked={isLocked} />

          {/* Weapon Mastery subsection */}
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-3 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-accent">Weapon Mastery</p>
            {mastery && !mastery.comingSoon ? (
              <MasteryLevels mastery={mastery} />
            ) : (
              <div className="rounded-sm border border-dashed border-border bg-bg-overlay/30 px-4 py-6 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-subtle">Mastery coming soon</p>
                <p className="mx-auto mt-1.5 max-w-sm text-[0.7rem] text-text-subtle">
                  Mastery challenges for this gun are on the way.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Expanded detail body (cleaner layout of the old popup)
   ============================================================ */

function ArmoryDetailBody({ entry, isLocked }: { entry: ArmoryEntry; isLocked: boolean }) {
  const fireRateLabel = entry.spec ? formatFireRate(entry.spec.fireRate) : entry.gunFireRate || "–";

  return (
    <div className="flex flex-col gap-4">
      {/* Locked -> unlock progress detail */}
      {isLocked && (
        <div>
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-text-muted">Unlock progress</p>
          <div className="mt-2">
            <AnimatedProgressBar pct={entry.unlockProgressPct} play className="h-2" />
          </div>
          {entry.unlockReqPoints > 0 ? (
            <p className="mt-2 text-sm text-text-muted">
              {entry.pointsTowardUnlock.toLocaleString("en-US")}
              {" / "}
              {entry.unlockReqPoints.toLocaleString("en-US")} XP
            </p>
          ) : (
            entry.unlockProgressText !== "" && <p className="mt-2 text-sm text-text-muted">{entry.unlockProgressText}</p>
          )}
          {(entry.unlockPrereqClass !== "" || entry.unlockPrereqGun !== "") && (
            <p className="mt-2 text-xs text-text-muted">
              {entry.unlockPrereqClass !== "" && (
                <>Prerequisite class: <span className="font-semibold text-text">{entry.unlockPrereqClass}</span></>
              )}
              {entry.unlockPrereqClass !== "" && entry.unlockPrereqGun !== "" && " · "}
              {entry.unlockPrereqGun !== "" && (
                <>Prerequisite gun: <span className="font-semibold text-text">{entry.unlockPrereqGun}</span></>
              )}
            </p>
          )}
        </div>
      )}

      {/* Weapon spec */}
      <div>
        <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-text-muted">Weapon</p>
        <div className="grid grid-cols-4 gap-1.5">
          <DetailStat label="Mag" value={fmtNum(entry.spec?.magSize ?? entry.gunMagSize)} />
          <DetailStat label="Dmg" value={fmtNum(entry.spec?.damage ?? entry.gunDamage)} />
          <DetailStat
            label="Reload"
            value={(() => {
              const reload = entry.spec?.reloadSeconds ?? entry.gunReload;
              return reload > 0 ? `${fmtShort(reload)}s` : "–";
            })()}
          />
          <DetailStat label="Rate" value={fireRateLabel} />
        </div>
        {entry.spec && (
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {entry.spec.length > 0 && <DetailStat label="Length" value={fmtNum(entry.spec.length)} />}
            {entry.spec.weight > 0 && <DetailStat label="Weight" value={fmtNum(entry.spec.weight)} />}
            {entry.spec.difficulty !== "" && <DetailStat label="Diff." value={entry.spec.difficulty} />}
            {entry.spec.unlockTier !== "" && <DetailStat label="Tier" value={entry.spec.unlockTier} />}
          </div>
        )}
      </div>

      {/* Your stats with this gun */}
      {!isLocked && entry.hasUsedGun && (
        <div>
          <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-accent">Your stats with this gun</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <StatGroup>
              <DetailStat label="Matches" value={fmtNum(entry.matchesUsed)} />
              <DetailStat label="Match Win %" value={fmtRate(entry.winsUsingGun, entry.matchesUsed)} />
            </StatGroup>
            <StatGroup>
              <DetailStat label="Kills" value={fmtNum(entry.killsTotal)} />
              <DetailStat label="Kills / Round" value={entry.killsPerRound.toFixed(1)} />
            </StatGroup>
            <StatGroup>
              <DetailStat label="Damage" value={fmtNum(entry.damageTotal)} />
              <DetailStat label="Avg Damage" value={fmtFloat(entry.avgDamage)} />
            </StatGroup>
            <StatGroup>
              <DetailStat label="Score" value={fmtNum(entry.scoreTotal)} />
              <DetailStat label="Avg Score" value={fmtFloat(entry.avgScore)} />
            </StatGroup>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <DetailStat label="K/D" value={fmtFloat(entry.kdRatio)} />
            <DetailStat label="Acc %" value={fmtPct(entry.avgAccuracy)} />
            <DetailStat label="Rounds Won" value={fmtNum(entry.roundsWonUsingGun)} />
            <DetailStat label="Avg Rating" value={fmtFloat(entry.avgMatchRating)} />
          </div>
        </div>
      )}

      {entry.spec?.description && entry.spec.description !== "" && (
        <p className="border-t border-border pt-3 text-sm leading-relaxed text-text-muted">{entry.spec.description}</p>
      )}
    </div>
  );
}

function StatGroup({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-1 rounded-sm border border-border bg-bg-overlay/40 p-2">{children}</div>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">{label}</p>
      <p className="mt-1 font-mono text-base font-extrabold tabular-nums text-accent sm:text-2xl">{value}</p>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-[0.55rem] font-bold uppercase tracking-[0.1em] text-text-muted">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-extrabold tabular-nums text-accent sm:text-base">{value}</p>
    </div>
  );
}

function fmtNum(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "–";
  return fmtShort(value);
}
function fmtShort(value: number): string {
  if (!Number.isFinite(value)) return "–";
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  return value.toFixed(1).replace(/\.0$/, "");
}
function fmtFloat(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "–";
  const trimmed = value.toFixed(2).replace(/\.?0+$/, "");
  const [intPart, fracPart] = trimmed.split(".");
  const intWithCommas = Number(intPart).toLocaleString("en-US");
  return fracPart ? `${intWithCommas}.${fracPart}` : intWithCommas;
}
function fmtPct(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "–";
  const asPct = value <= 1.5 ? value * 100 : value;
  return `${asPct.toFixed(1).replace(/\.0$/, "")}%`;
}
function fmtRate(numerator: number, denominator: number): string {
  if (!Number.isFinite(denominator) || denominator <= 0) return "–";
  if (!Number.isFinite(numerator)) return "–";
  const pct = (numerator / denominator) * 100;
  return `${pct.toFixed(1).replace(/\.0$/, "")}%`;
}
