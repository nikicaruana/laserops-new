"use client";

/**
 * components/admin/MatchSquadColours.tsx
 * --------------------------------------------------------------------
 * For a ladder / casual squad-vs-squad match, assign each squad the team COLOUR
 * it plays as. Admins set these around go-live so the match report shows squad
 * badges per colour and the winning squad can be tied to a team score. Writes
 * matches.home_squad_colour / away_squad_colour (admin_all RLS).
 *
 * Colours can be auto-detected from the game data: "Detect from game data" calls
 * detect_match_squad_colours, which reads which team colour each squad's members
 * actually played on (headband -> account -> squad) and fills both dropdowns. The
 * same derivation runs automatically at ingestion; this button is the manual
 * trigger / re-detect, and the dropdowns still let an admin override.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

const sel = "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

export function MatchSquadColours({
  matchId,
  homeName,
  awayName,
  colours,
  initialHomeColour,
  initialAwayColour,
}: {
  matchId: string;
  homeName: string;
  awayName: string;
  colours: { colour: string; label: string }[];
  initialHomeColour: string | null;
  initialAwayColour: string | null;
}) {
  const router = useRouter();
  const [home, setHome] = useState(initialHomeColour ?? "");
  const [away, setAway] = useState(initialAwayColour ?? "");
  const [busy, setBusy] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectMsg, setDetectMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const colourLabel = (colour: string) => colours.find((c) => c.colour === colour)?.label ?? colour;

  async function detect() {
    setError(null);
    setDetectMsg(null);
    setDetecting(true);
    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("detect_match_squad_colours", { p_match_id: matchId });
    setDetecting(false);
    if (err) return setError(err.message);
    const row = Array.isArray(data) ? data[0] : data;
    const detectedHome: string | null = row?.home_colour ?? null;
    const detectedAway: string | null = row?.away_colour ?? null;
    if (!detectedHome && !detectedAway) {
      setDetectMsg("No team data yet. Colours are detected once the game files are ingested.");
      return;
    }
    if (detectedHome) setHome(detectedHome);
    if (detectedAway) setAway(detectedAway);
    setSaved(false);
    setDetectMsg(
      `Detected: ${detectedHome ? `${homeName} ${colourLabel(detectedHome)}` : `${homeName} –`}, ${detectedAway ? `${awayName} ${colourLabel(detectedAway)}` : `${awayName} –`}. Saved.`,
    );
    router.refresh();
  }

  async function save() {
    setError(null);
    if (home && away && home === away) return setError("The two squads can't share a colour.");
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("matches")
      .update({ home_squad_colour: home || null, away_squad_colour: away || null })
      .eq("id", matchId);
    setBusy(false);
    if (err) return setError(err.message);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    router.refresh();
  }

  const dropdown = (value: string, onChange: (v: string) => void) => (
    <select className={sel} value={value} onChange={(e) => { onChange(e.target.value); setSaved(false); }}>
      <option value="">Not set</option>
      {colours.map((c) => <option key={c.colour} value={c.colour}>{c.label}</option>)}
    </select>
  );

  return (
    <div className="border border-border bg-bg-elevated px-4 py-4">
      <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-muted">Team colours</p>
      <p className="mt-1 mb-3 text-xs text-text-subtle">Which colour each squad plays as. Auto-detected from the game data at ingestion; detect or override it here. Used for badges in the match report and to move the ladder.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={lbl}>{homeName}</label>{dropdown(home, setHome)}</div>
        <div><label className={lbl}>{awayName}</label>{dropdown(away, setAway)}</div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" onClick={save} disabled={busy || detecting}>Save colours</Button>
        <button
          type="button"
          onClick={detect}
          disabled={busy || detecting}
          className="border border-border-strong px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {detecting ? "Detecting…" : "Detect from game data"}
        </button>
        {saved && <span className="text-xs text-accent">Saved.</span>}
      </div>
      {detectMsg && <p className="mt-2 text-xs text-text-muted">{detectMsg}</p>}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
