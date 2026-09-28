"use client";

/**
 * components/live/LiveRoundView.tsx
 * --------------------------------------------------------------------
 * The on-phone live round view, rendered from the COMPACT LiveSnapshot the
 * producer pushes (precomputed stats/feed/streaks — small + fixed size). Base
 * timers are the only thing computed from the local clock `t`, so they tick
 * smoothly between snapshots without shipping the whole event log. Two modes:
 *   - "player": personal scorecard + own kill feed (tap-to-taunt) + own streaks.
 *   - "public": global kill feed + compact leaderboard, no streaks.
 */
import { useMemo, useState } from "react";
import { type LiveSnapshot, teamHex, mmss, sb, BASE_IMAGES, baseStateAt, STREAK_NAMES } from "@/lib/live-sim/engine";
import { cldImage } from "@/lib/cld";
import { PixelStatic } from "@/components/live/PixelStatic";
import { killstreakOverlayLabel, type KillstreakDef, type ActiveDeployment } from "@/lib/killstreaks";

function BaseEmblem({ color, size = 40 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <path d="M50 4 L61 39 L96 50 L61 61 L50 96 L39 61 L4 50 L39 39 Z" fill={color} />
      <circle cx="50" cy="50" r="12" fill="#0b0b0b" /><circle cx="50" cy="50" r="6" fill={color} />
    </svg>
  );
}

export function LiveRoundView({
  snap, t, mode, me = null, roundLabel, live = true, onTaunt, incomingTaunts = [],
  killstreakDefs = [], deployments = [], onDeployKillstreak,
}: {
  snap: LiveSnapshot;
  t: number;
  mode: "player" | "public";
  me?: string | null;
  roundLabel?: string;
  live?: boolean;
  /** Player mode: send a 🖕 to an opponent who killed you. */
  onTaunt?: (to: string) => void;
  /** Player mode: taunts received from others (newest last). */
  incomingTaunts?: { from: string; id: string }[];
  /** Killstreak defs (from killstreak_definitions). */
  killstreakDefs?: KillstreakDef[];
  /** Active killstreak jams for the match (persisted; survive reload). */
  deployments?: ActiveDeployment[];
  /** Player mode: deploy a killstreak on the enemy feed. */
  onDeployKillstreak?: (def: KillstreakDef, baseIds: number[]) => void;
}) {
  const [sentTaunts, setSentTaunts] = useState<Set<string>>(new Set());
  const bases = useMemo(() => baseStateAt(snap, t), [snap, t]);
  const gunOf = useMemo(() => new Map(snap.players.map((p) => [p.name, p])), [snap.players]);
  const winner = snap.winner;

  const mine = me ? snap.stats.find((s) => s.name === me) : undefined;
  const myRank = me ? snap.stats.findIndex((s) => s.name === me) + 1 : 0;
  const kd = mine ? (mine.deaths > 0 ? mine.kills / mine.deaths : mine.kills) : 0;
  const myStreaks = (me && snap.streaksByPlayer[me]) || [];

  // Killstreaks: defs + active jams come from the parent (DB-backed). Availability
  // is the player's unlock-streak earns this round minus their deploys this round.
  const [armed, setArmed] = useState<string | null>(null);
  const nowMs = Date.now();
  const defsByKey = useMemo(() => new Map(killstreakDefs.map((d) => [d.key, d])), [killstreakDefs]);
  const myTeam = mine?.team ?? null;
  const activeDeploys = deployments.filter((d) => d.expiresAtMs > nowMs);
  const incoming = mode === "player" && me && myTeam ? activeDeploys.filter((d) => d.byTeam !== myTeam) : [];
  const outgoing = mode === "player" && me && myTeam ? activeDeploys.filter((d) => d.byTeam === myTeam) : [];
  const jamOnBase = (baseId: number) => incoming.find((d) => d.scope === "all" || d.baseIds.includes(baseId)) ?? null;
  const earnedByKey = useMemo(() => { const m: Record<string, number> = {}; for (const s of myStreaks) m[s.key] = (m[s.key] ?? 0) + 1; return m; }, [myStreaks]);
  const myDeployCount = (key: string) => deployments.filter((d) => d.byPlayer === me && d.roundNo === snap.round && d.killstreakKey === key).length;
  const ksAvail = mode === "player" && me
    ? killstreakDefs
        .map((k) => ({ def: k, available: Math.max(0, (k.unlockStreakKey ? earnedByKey[k.unlockStreakKey] ?? 0 : 0) - myDeployCount(k.key)) }))
        .filter((x) => x.available > 0)
    : [];
  const armedDef = armed ? defsByKey.get(armed) ?? null : null;
  function tapBase(baseId: number) {
    if (!armedDef || !onDeployKillstreak) return;
    onDeployKillstreak(armedDef, armedDef.scope === "all" ? [] : [baseId]);
    setArmed(null);
  }

  // Personal feed: my involvement, newest first. Public feed: all kills, newest first.
  const pFeed = useMemo(() => {
    if (mode !== "player" || !me) return [];
    return snap.recentKills.filter((k) => k.actor === me || k.victim === me).slice().reverse().slice(0, 15);
  }, [mode, me, snap.recentKills]);
  const gFeed = useMemo(() => (mode === "public" ? snap.recentKills.slice().reverse().slice(0, 20) : []), [mode, snap.recentKills]);

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col gap-2 text-text">
      <style>{`
        @keyframes lsSize{0%,100%{transform:scale(1)}50%{transform:scale(1.14)}}
        @keyframes lsGlow{0%,100%{filter:brightness(1)}50%{filter:brightness(1.55)}}
        @keyframes lsArm{0%,100%{box-shadow:0 0 0 2px var(--color-accent),0 0 0 4px rgba(255,222,0,0.15)}50%{box-shadow:0 0 0 2px var(--color-accent),0 0 0 7px rgba(255,222,0,0.35)}}
        .ls-armed{animation:lsArm 1.1s ease-in-out infinite;border-radius:0.6rem;}
        .ls-scroll{scrollbar-width:thin;scrollbar-color:var(--color-accent-dim) transparent;}
        .ls-scroll::-webkit-scrollbar{width:6px;height:6px;}
        .ls-scroll::-webkit-scrollbar-thumb{background:var(--color-accent-dim);border-radius:9999px;}
      `}</style>

      <div className="flex shrink-0 items-center justify-between px-1">
        <span className="text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-text-muted">{roundLabel ?? `Round ${snap.round}`}</span>
        {mode === "player" && me && (
          <span className="flex min-w-0 items-center justify-center gap-1.5 text-sm font-bold">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: teamHex(mine?.team ?? null) }} />
            <span className="truncate">{me}</span>
          </span>
        )}
        {winner ? (
          <span className="text-[0.62rem] font-bold uppercase tracking-[0.14em]" style={{ color: teamHex(winner) }}>{winner} wins</span>
        ) : live ? (
          <span className="flex items-center gap-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-red-400"><span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> Live</span>
        ) : null}
      </div>

      {/* Base capture states — also the killstreak target picker while armed */}
      <div className={`grid shrink-0 grid-cols-3 gap-2 ${armedDef ? "ls-armed p-0.5" : ""}`}>
        {snap.bases.map((base) => {
          const st = bases[base.id];
          const owner = st?.owner ?? null;
          const burned = st?.burned;
          const anim = st?.anim ?? "none";
          const sizeAnim = anim === "crit" ? "lsSize 0.7s ease-in-out infinite" : anim === "warn" ? "lsSize 1.1s ease-in-out infinite" : undefined;
          const img = owner ? BASE_IMAGES[owner.toLowerCase()] : BASE_IMAGES["neutral"];
          const jam = jamOnBase(base.id);
          const jamDef = jam ? defsByKey.get(jam.killstreakKey) : null;
          return (
            <div key={base.id} onClick={armedDef ? () => tapBase(base.id) : undefined} className={`relative rounded-lg p-2 text-center ${armedDef ? "cursor-pointer hover:ring-2 hover:ring-accent" : ""}`} style={{ borderStyle: burned ? "dotted" : "solid", borderWidth: burned ? 3 : 1, borderColor: burned ? teamHex(st!.burnTeam) : teamHex(owner) + "88", backgroundColor: teamHex(owner) + "14", animation: anim === "crit" ? "lsGlow 0.7s ease-in-out infinite" : undefined }}>
              <div className="flex justify-center" style={{ animation: sizeAnim }}>{img ? <img src={cldImage(img, { w: 96 })} alt={base.name} className="h-10 w-10 object-contain" /> : <BaseEmblem color={teamHex(owner)} />}</div>
              <div className="mt-1 truncate text-[0.65rem] font-extrabold uppercase tracking-[0.06em]" title={base.name} style={{ color: burned ? teamHex(st!.burnTeam) : undefined }}>{base.name}</div>
              <div className="mt-1 space-y-0.5">
                {snap.teams.map((tm) => { const held = st?.hold[tm] ?? 0; const isOwner = owner === tm; return (
                  <div key={tm} className={`flex items-center justify-center gap-1 tabular-nums ${isOwner ? "font-extrabold" : "opacity-70"}`} style={{ color: teamHex(tm), fontSize: isOwner ? "0.95rem" : "0.6rem", animation: isOwner ? sizeAnim : undefined }}>
                    <span className="inline-block rounded-full" style={{ width: isOwner ? 7 : 5, height: isOwner ? 7 : 5, backgroundColor: teamHex(tm) }} />{mmss(held)}
                  </div>
                ); })}
              </div>
              {jam && jamDef && <PixelStatic label={killstreakOverlayLabel(jamDef, jam.byPlayer)} />}
            </div>
          );
        })}
      </div>

      {/* Outgoing jam — you + your team see what you're scrambling */}
      {mode === "player" && outgoing.length > 0 && (
        <div className="shrink-0 space-y-1.5 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-2">
          {outgoing.map((d) => {
            const def = defsByKey.get(d.killstreakKey);
            const target = d.scope === "all" ? "All bases" : snap.bases.filter((b) => d.baseIds.includes(b.id)).map((b) => b.name).join(", ");
            const who = d.byPlayer === me ? "You" : d.byPlayer;
            return (
              <div key={d.id} className="flex items-center gap-2.5">
                {def?.badgeUrl ? <img src={cldImage(def.badgeUrl, { w: 96 })} alt={def.name} className="h-9 w-9 shrink-0 object-contain" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center text-2xl">{def?.icon || "•"}</span>}
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-xs font-bold text-text">{who}</div>
                  <div className="truncate text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-text-muted">{target}</div>
                </div>
                <span className="shrink-0 font-mono text-xs tabular-nums text-text-muted">{mmss(Math.max(0, Math.ceil((d.expiresAtMs - nowMs) / 1000)))}</span>
              </div>
            );
          })}
        </div>
      )}

      {mode === "player" ? (
        <>
          <div className="shrink-0 rounded-lg bg-bg-elevated p-3">
            <div className="flex items-end justify-between">
              <div><div className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-text-subtle">Live score</div><div className="text-2xl font-extrabold leading-none tabular-nums text-accent">{mine?.score.toLocaleString("en-US") ?? 0}</div></div>
              <div className="text-right text-sm text-text-muted">Rank #{myRank || "–"} / {snap.players.length}</div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
              {[["Kills", mine?.kills ?? 0], ["Deaths", mine?.deaths ?? 0], ["K/D", kd.toFixed(2)], ["Caps", mine?.caps ?? 0], ["Dmg", Math.round(mine?.damage ?? 0)], ["Hold", mmss(Math.round(mine?.hold ?? 0))]].map(([k, v]) => (<div key={k as string} className="rounded-md bg-bg py-1.5"><div className="text-base font-bold tabular-nums">{v}</div><div className="text-[0.5rem] uppercase tracking-[0.08em] text-text-subtle">{k}</div></div>))}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-1 shrink-0 px-1 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-text-subtle">Your kill feed</div>
            <ul className="ls-scroll min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
              {incomingTaunts.slice().reverse().map((tw) => (
                <li key={tw.id} className="flex items-center justify-between gap-2 rounded-md bg-bg-elevated px-2 py-1 text-xs text-text-muted">
                  <span>🖕 from <span className="font-semibold text-text">{tw.from}</span></span>
                </li>
              ))}
              {pFeed.length === 0 && incomingTaunts.length === 0 && <li className="px-1 text-xs text-text-subtle">Nothing involving you yet…</li>}
              {pFeed.map((f, i) => {
                const isKill = f.actor === me;
                const other = isKill ? f.victim : f.actor;
                const otherTeam = isKill ? f.victimTeam : f.actorTeam;
                const tid = `${f.t}:${f.actor}:${f.victim}`;
                if (isKill) return (
                  <li key={i} className="flex items-center gap-1.5 rounded-md bg-emerald-950/30 px-2 py-1 text-xs"><span className="font-semibold text-emerald-300">You</span>{gunOf.get(me!)?.gunImage ? <img src={cldImage(gunOf.get(me!)!.gunImage, { w: 96 })} alt="" className="h-5 w-auto opacity-90" /> : <span>›</span>}<span className="truncate" style={{ color: teamHex(otherTeam) }}>{other}</span>{f.spawn && <span className="ml-auto rounded bg-red-900/60 px-1 text-[0.5rem] font-bold uppercase text-red-300">spawn</span>}</li>
                );
                return (
                  <li key={i} className="flex items-center gap-1.5 rounded-md bg-red-950/30 px-2 py-1 text-xs"><span className="truncate font-semibold" style={{ color: teamHex(otherTeam) }}>{other}</span>{gunOf.get(other)?.gunImage ? <img src={cldImage(gunOf.get(other)!.gunImage, { w: 96 })} alt="" className="h-5 w-auto opacity-90" /> : <span>›</span>}<span className="text-red-300">You</span>{sentTaunts.has(tid) ? <span className="ml-auto text-text-subtle">🖕 sent</span> : <button type="button" onClick={() => { onTaunt?.(other); setSentTaunts((p) => new Set(p).add(tid)); }} className="ml-auto shrink-0 rounded border border-border-strong px-1.5 py-0.5 text-[0.6rem] hover:border-accent" title={`Send ${other} a 🖕`}>🖕</button>}</li>
                );
              })}
            </ul>
          </div>

          {armedDef ? (
            <button type="button" onClick={() => setArmed(null)} className="ls-armed shrink-0 bg-accent/10 px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1.5 text-[0.55rem] font-bold uppercase tracking-[0.14em] text-accent">{armedDef.badgeUrl ? <img src={cldImage(armedDef.badgeUrl, { w: 64 })} alt="" className="h-4 w-4 object-contain" /> : <span>{armedDef.icon || "•"}</span>} {armedDef.name} armed</div>
              <div className="mt-0.5 text-xs font-semibold text-text">{armedDef.armInstructions ?? "Tap a base to deploy, or tap here to cancel"}</div>
            </button>
          ) : (
            <div className="flex shrink-0 items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="mb-1 px-1 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-text-subtle">Your streaks</div>
                <div className="flex items-center -space-x-2 overflow-hidden">
                  {myStreaks.length === 0 && <span className="px-1 text-xs text-text-subtle">None yet — get on a run!</span>}
                  {myStreaks.slice(0, 6).map((s, i) => (<img key={i} src={cldImage(sb(s.key), { w: 160, trim: true })} alt={STREAK_NAMES[s.key] ?? s.key} title={STREAK_NAMES[s.key] ?? s.key} style={{ zIndex: 90 - i }} className="relative h-[4.5rem] w-auto shrink-0 object-contain" />))}
                </div>
              </div>
              {ksAvail.length > 0 && (
                <div className="shrink-0">
                  <div className="mb-1 px-1 text-right text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-text-subtle">Killstreaks</div>
                  <div className="flex justify-end">
                    <div className="flex items-center gap-0 rounded-lg border border-accent/50 bg-accent/10 p-0.5">
                      {ksAvail.map(({ def, available }) => (
                        <button key={def.key} type="button" onClick={() => setArmed(def.key)} title={`Deploy ${def.name}`} className="relative flex shrink-0 items-center justify-center rounded-md transition-colors hover:bg-accent/20">
                          {def.badgeUrl ? <img src={cldImage(def.badgeUrl, { w: 160 })} alt={def.name} className="h-[4.5rem] w-[4.5rem] object-contain" /> : <span className="flex h-[4.5rem] w-[4.5rem] items-center justify-center text-4xl">{def.icon || "•"}</span>}
                          {available > 1 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.55rem] font-bold text-bg">{available}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-1 shrink-0 px-1 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-text-subtle">Kill feed</div>
            <ul className="ls-scroll min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
              {gFeed.length === 0 && <li className="px-1 text-xs text-text-subtle">No kills yet…</li>}
              {gFeed.map((f, i) => (
                <li key={i} className="flex items-center gap-1.5 rounded-md bg-bg-elevated px-2 py-1 text-xs">
                  <span className="truncate font-semibold" style={{ color: teamHex(f.actorTeam) }}>{f.actor}</span>
                  {gunOf.get(f.actor)?.gunImage ? <img src={cldImage(gunOf.get(f.actor)!.gunImage, { w: 96 })} alt="" className="h-5 w-auto opacity-90" /> : <span>›</span>}
                  <span className="truncate" style={{ color: teamHex(f.victimTeam) }}>{f.victim}</span>
                  {f.spawn && <span className="ml-auto rounded bg-red-900/60 px-1 text-[0.5rem] font-bold uppercase text-red-300">spawn</span>}
                </li>
              ))}
            </ul>
          </div>

          <div className="shrink-0">
            <div className="mb-1 px-1 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-text-subtle">Leaderboard</div>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-xs tabular-nums">
                <tbody>
                  {snap.stats.slice(0, 6).map((s, i) => (
                    <tr key={s.name} className="border-t border-border first:border-0">
                      <td className="px-2 py-1 text-text-subtle">{i + 1}</td>
                      <td className="px-2 py-1"><span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: teamHex(s.team) }} /><span className="truncate">{s.name}</span></span></td>
                      <td className="px-2 py-1 text-right font-bold text-accent">{s.score.toLocaleString("en-US")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
