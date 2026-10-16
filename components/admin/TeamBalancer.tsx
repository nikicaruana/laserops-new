"use client";

/**
 * components/admin/TeamBalancer.tsx
 * --------------------------------------------------------------------
 * Admin team-builder for one game. Starts from an ELO-balanced,
 * playstyle-spread split (computed server-side), then lets the admin:
 *  - pick each team's colour (default Blue / Yellow),
 *  - drag players between teams (drop on the column) or onto an opposing
 *    player card to SWAP the two (the target card dims and shows a SWAP tag),
 *  - watch live per-team totals (count, total/avg ELO, fraggers, objective),
 *  - re-run the auto-balance, and save the teams back to the roster.
 * Saving writes match_participants.assigned_team (the chosen colour) under the
 * admin session + RLS.
 */
import { useMemo, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { balanceTeams, type BalancePlayer, type PlayerStyle, type TeamAssignment } from "@/lib/admin/team-balancer";
import { cn } from "@/lib/cn";

type ColourOption = { colour: string; label: string };
type Side = "A" | "B";

const COLOUR_HEX: Record<string, string> = {
  red: "#ef4444",
  blue: "#3b82f6",
  yellow: "#ffde00",
  green: "#22c55e",
  white: "#e5e7eb",
  black: "#4b5563",
  orange: "#f97316",
  purple: "#a855f7",
  cyan: "#06b6d4",
  pink: "#ec4899",
};
const hex = (c: string) => COLOUR_HEX[c.toLowerCase()] ?? "#9ca3af";

const STYLE_META: Record<PlayerStyle, { label: string; cls: string }> = {
  fragger: { label: "Fragger", cls: "text-red-400 border-red-500/50" },
  objective: { label: "Objective", cls: "text-sky-400 border-sky-500/50" },
  balanced: { label: "Balanced", cls: "text-text-subtle border-border-strong" },
};

export function TeamBalancer({
  players,
  colourOptions,
  initial,
  defaultColourA,
  defaultColourB,
  locked = false,
}: {
  matchId: string;
  players: BalancePlayer[];
  colourOptions: ColourOption[];
  initial: TeamAssignment;
  defaultColourA: string;
  defaultColourB: string;
  locked?: boolean;
}) {
  const router = useRouter();
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const [colourA, setColourA] = useState(defaultColourA);
  const [colourB, setColourB] = useState(defaultColourB);
  const [teamA, setTeamA] = useState<string[]>(initial.teamA);
  const [teamB, setTeamB] = useState<string[]>(initial.teamB);
  const [dragId, setDragId] = useState<string | null>(null);
  const [swapId, setSwapId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Display each team high -> low ELO.
  const sortByElo = (ids: string[]) => [...ids].sort((x, y) => (byId.get(y)?.elo ?? 0) - (byId.get(x)?.elo ?? 0));

  const totals = (ids: string[]) => {
    let elo = 0;
    let frag = 0;
    let obj = 0;
    for (const id of ids) {
      const p = byId.get(id);
      if (!p) continue;
      elo += p.elo;
      if (p.style === "fragger") frag += 1;
      else if (p.style === "objective") obj += 1;
    }
    return { count: ids.length, elo: Math.round(elo), avg: ids.length ? Math.round(elo / ids.length) : 0, frag, obj };
  };
  const tA = totals(teamA);
  const tB = totals(teamB);
  const eloGap = Math.abs(tA.elo - tB.elo);

  const sideOf = (id: string): Side => (teamA.includes(id) ? "A" : "B");

  function moveTo(id: string, side: Side) {
    setTeamA((prev) => (side === "A" ? [...prev.filter((x) => x !== id), id] : prev.filter((x) => x !== id)));
    setTeamB((prev) => (side === "B" ? [...prev.filter((x) => x !== id), id] : prev.filter((x) => x !== id)));
  }
  function swap(a: string, b: string) {
    setTeamA((prev) => prev.map((x) => (x === a ? b : x === b ? a : x)));
    setTeamB((prev) => prev.map((x) => (x === a ? b : x === b ? a : x)));
  }

  // Tap-to-select (touch-friendly; works alongside drag on desktop). Tap a
  // player to pick them up, then tap an opposing player to SWAP or the other
  // column to MOVE. Tap the selected player again to cancel.
  function onCardTap(id: string, side: Side) {
    if (locked) return;
    if (selectedId === id) {
      setSelectedId(null);
      return;
    }
    if (selectedId) {
      const selSide = sideOf(selectedId);
      if (selSide !== side) swap(selectedId, id);
      else {
        setSelectedId(id);
        return;
      }
      setSelectedId(null);
      return;
    }
    setSelectedId(id);
  }
  function onColumnTap(side: Side) {
    if (locked) return;
    if (selectedId && sideOf(selectedId) !== side) moveTo(selectedId, side);
    setSelectedId(null);
  }

  function onDragStart(e: DragEvent<HTMLDivElement>, id: string) {
    setDragId(id);
    setMsg(null);
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", id);
    } catch {
      /* some browsers restrict setData; dragId state is the source of truth */
    }
  }
  function onDragEnd() {
    setDragId(null);
    setSwapId(null);
  }
  function onColumnDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (swapId) setSwapId(null);
  }
  function onColumnDrop(e: DragEvent<HTMLDivElement>, side: Side) {
    e.preventDefault();
    if (dragId) moveTo(dragId, side);
    setDragId(null);
    setSwapId(null);
  }
  function onCardDragOver(e: DragEvent<HTMLDivElement>, targetId: string, targetSide: Side) {
    e.preventDefault();
    e.stopPropagation();
    if (dragId && dragId !== targetId && sideOf(dragId) !== targetSide) setSwapId(targetId);
    else setSwapId(null);
  }
  function onCardDrop(e: DragEvent<HTMLDivElement>, targetId: string, targetSide: Side) {
    e.preventDefault();
    e.stopPropagation();
    if (dragId && dragId !== targetId) {
      if (sideOf(dragId) !== targetSide) swap(dragId, targetId);
      else moveTo(dragId, targetSide);
    }
    setDragId(null);
    setSwapId(null);
  }

  function autoBalance() {
    const res = balanceTeams(players);
    setTeamA(res.teamA);
    setTeamB(res.teamB);
    setSelectedId(null);
    setMsg(null);
    setErr(null);
  }
  function resetTeams() {
    setTeamA(initial.teamA);
    setTeamB(initial.teamB);
    setSelectedId(null);
    setMsg(null);
    setErr(null);
  }
  function pickColour(side: Side, val: string) {
    if (side === "A") {
      setColourA(val);
      if (val === colourB) {
        const alt = colourOptions.find((o) => o.colour !== val);
        if (alt) setColourB(alt.colour);
      }
    } else {
      setColourB(val);
      if (val === colourA) {
        const alt = colourOptions.find((o) => o.colour !== val);
        if (alt) setColourA(alt.colour);
      }
    }
  }

  async function save() {
    if (locked) return;
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const sb = createClient();
      // Each player's team colour is saved on the table its row came from
      // (match_participants for the roster, match_signups pre-roster).
      const idsIn = (ids: string[], src: "participant" | "signup") => ids.filter((id) => byId.get(id)?.source === src);
      const writes: { table: "match_participants" | "match_signups"; ids: string[]; colour: string }[] = [
        { table: "match_participants", ids: idsIn(teamA, "participant"), colour: colourA },
        { table: "match_participants", ids: idsIn(teamB, "participant"), colour: colourB },
        { table: "match_signups", ids: idsIn(teamA, "signup"), colour: colourA },
        { table: "match_signups", ids: idsIn(teamB, "signup"), colour: colourB },
      ];
      for (const w of writes) {
        if (!w.ids.length) continue;
        const { error } = await sb.from(w.table).update({ assigned_team: w.colour }).in("id", w.ids);
        if (error) throw new Error(error.message);
      }
      setMsg("Teams saved.");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save teams.");
    } finally {
      setSaving(false);
    }
  }

  function card(id: string, side: Side) {
    const p = byId.get(id);
    if (!p) return null;
    const isDragging = dragId === id;
    const isSwap = swapId === id;
    const colour = side === "A" ? colourA : colourB;
    const isSelected = selectedId === id;
    return (
      <div
        key={id}
        draggable={!locked}
        onClick={(e) => {
          e.stopPropagation();
          onCardTap(id, side);
        }}
        onDragStart={(e) => onDragStart(e, id)}
        onDragEnd={onDragEnd}
        onDragOver={(e) => onCardDragOver(e, id, side)}
        onDrop={(e) => onCardDrop(e, id, side)}
        className={cn(
          "relative select-none border bg-bg-elevated px-2.5 py-2 transition-opacity sm:px-3",
          locked ? "cursor-default" : "cursor-pointer sm:cursor-grab sm:active:cursor-grabbing",
          isDragging ? "opacity-40" : isSwap ? "opacity-60 border-accent" : isSelected ? "border-accent ring-1 ring-accent" : "border-border hover:border-border-strong",
        )}
        style={{ borderLeft: `3px solid ${hex(colour)}` }}
      >
        {isSwap && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
            <span className="border border-accent bg-accent px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-[0.2em] text-bg">Swap</span>
          </div>
        )}
        <div className="flex items-start justify-between gap-1.5">
          <span className="min-w-0 flex-1 truncate text-[0.8rem] font-semibold leading-tight text-text">{p.name}</span>
          <span className="flex-none text-right leading-none">
            <span className="block font-mono text-sm font-bold tabular-nums text-text">{Math.round(p.elo)}</span>
            <span className="block text-[0.5rem] font-bold uppercase tracking-wider text-text-subtle">ELO</span>
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-1">
          <span className={cn("border px-1 py-0.5 text-[0.5rem] font-bold uppercase tracking-[0.08em]", STYLE_META[p.style].cls)}>{STYLE_META[p.style].label}</span>
          <span className="truncate text-[0.6rem] text-text-subtle">{p.hasStats ? `K/D ${p.kd.toFixed(1)}` : "No stats"}</span>
        </div>
      </div>
    );
  }

  function column(side: Side) {
    const ids = side === "A" ? teamA : teamB;
    const colour = side === "A" ? colourA : colourB;
    return (
      <div className="min-w-0 flex-1" onClick={() => onColumnTap(side)} onDragOver={onColumnDragOver} onDrop={(e) => onColumnDrop(e, side)}>
        <div className="mb-3 flex items-center gap-1.5 border-b-2 pb-2" style={{ borderColor: hex(colour) }}>
          <span className="h-3 w-3 flex-none rounded-full" style={{ background: hex(colour) }} />
          <select
            value={colour}
            onChange={(e) => pickColour(side, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            disabled={locked}
            className="min-w-0 border border-border-strong bg-bg px-1.5 py-1 text-xs font-bold uppercase tracking-wide text-text focus:border-accent focus:outline-none disabled:opacity-60 sm:text-sm"
          >
            {colourOptions.map((o) => (
              <option key={o.colour} value={o.colour}>{o.label}</option>
            ))}
          </select>
          <span className="ml-auto flex-none text-[0.65rem] font-semibold text-text-subtle sm:text-xs">{ids.length}</span>
        </div>
        <div className="flex min-h-[140px] flex-col gap-2">
          {sortByElo(ids).map((id) => card(id, side))}
          {ids.length === 0 && <p className="grid flex-1 place-items-center border border-dashed border-border px-2 py-8 text-center text-[0.65rem] text-text-subtle">Tap or drop a player here</p>}
        </div>
      </div>
    );
  }

  function totalBox(side: Side) {
    const t = side === "A" ? tA : tB;
    const colour = side === "A" ? colourA : colourB;
    return (
      <div className="border border-border bg-bg-elevated p-3" style={{ borderTop: `3px solid ${hex(colour)}` }}>
        <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-muted">{colour}</p>
        <p className="mt-1 text-xl font-extrabold tabular-nums text-text">{t.elo} <span className="text-xs font-semibold text-text-subtle">ELO</span></p>
        <p className="mt-0.5 text-xs text-text-subtle">
          {t.count} players · avg {t.avg} · <span className="text-red-400">{t.frag} frag</span> · <span className="text-sky-400">{t.obj} obj</span>
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={autoBalance} className="border border-accent bg-accent/10 px-4 py-2 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-accent transition-colors hover:bg-accent/20">
          Auto-balance
        </button>
        <button type="button" onClick={resetTeams} className="border border-border-strong px-4 py-2 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-text-muted transition-colors hover:text-text">
          Reset
        </button>
        <button type="button" onClick={save} disabled={saving || locked} title={locked ? "Game already ingested - planner is read-only" : undefined} className="ml-auto border border-accent bg-accent px-5 py-2 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-bg transition-opacity hover:opacity-90 disabled:opacity-50">
          {saving ? "Saving…" : "Save teams"}
        </button>
      </div>

      {err && <p className="mb-3 border border-red-800 bg-red-950/40 px-4 py-2.5 text-sm text-red-400">{err}</p>}
      {msg && <p className="mb-3 border border-emerald-800 bg-emerald-950/30 px-4 py-2.5 text-sm text-emerald-400">{msg}</p>}

      <p className="mb-3 text-xs text-text-subtle">
        Tap a player to pick them up, then tap the other team to move them or tap an opposing player to swap. On desktop you can also drag. Each team is sorted by ELO. Totals update live below.
      </p>

      <div className="flex flex-row gap-2.5 sm:gap-5">
        {column("A")}
        {column("B")}
      </div>

      <div className="sticky bottom-0 z-20 mt-5 border-t border-border bg-bg/95 pb-1 pt-3 backdrop-blur">
        <div className="grid grid-cols-2 gap-3">
          {totalBox("A")}
          {totalBox("B")}
        </div>
        <p className="mt-2 text-center text-xs text-text-muted">
          ELO gap: <span className={cn("font-bold tabular-nums", eloGap <= 30 ? "text-emerald-400" : eloGap <= 80 ? "text-accent" : "text-red-400")}>{eloGap}</span>
          {" · "}
          {players.length} players total
        </p>
      </div>
    </div>
  );
}
