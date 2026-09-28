"use client";

/**
 * components/portal/CreatePlayerMatchForm.tsx
 * --------------------------------------------------------------------
 * Players open their own OPEN game. Simplified vs the admin creator: always a
 * public open match (no double XP / private / deposit). Date + 30-min start
 * time (08:00-21:00), end auto +3h feeds the title, editable. Goes through the
 * create_player_match RPC, which enforces the 3-active-games cap.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { AddPhoneModal } from "@/components/portal/AddPhoneModal";
import { AvailabilityPicker } from "@/components/portal/AvailabilityPicker";

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";
const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

const fmtMins = (mins: number) => {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
const addHours = (hhmm: string, hrs: number) => {
  const [h, m] = hhmm.split(":").map(Number);
  return fmtMins((h * 60 + m + hrs * 60) % 1440);
};

// Community open games are always a 10-player minimum, 3 hours, €35 per player.
const MIN_PLAYERS = 10;
const GAME_HOURS = 3;
const PRICE_EUR = 35;

export function CreatePlayerMatchForm({ opsTag }: { opsTag: string | null }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [title, setTitle] = useState("");
  const [titleDirty, setTitleDirty] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phonePrompt, setPhonePrompt] = useState(false);
  const [cfg, setCfg] = useState({ price: PRICE_EUR, sessionMinutes: GAME_HOURS * 60, bufferMinutes: 60 });
  useEffect(() => {
    const supabase = createClient();
    supabase.from("pricing_config").select("default_price_eur, session_minutes, booking_buffer_minutes").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setCfg({ price: Number(data.default_price_eur) || PRICE_EUR, sessionMinutes: Number(data.session_minutes) || GAME_HOURS * 60, bufferMinutes: Number(data.booking_buffer_minutes) || 60 });
    });
  }, []);
  const gameHours = cfg.sessionMinutes / 60;

  // End is always start + 3h; it only feeds the auto title.
  const endTime = startTime ? addHours(startTime, gameHours) : "";

  // Title is a fixed label (the date/time show in the subtext), until edited.
  useEffect(() => {
    if (titleDirty) return;
    setTitle(opsTag ? `${opsTag}'s Open Game` : "Open Game");
  }, [opsTag, titleDirty]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submit();
  }

  async function submit() {
    setError(null);
    if (!date || !startTime) {
      setError("Pick a date and start time.");
      return;
    }
    const when = new Date(`${date}T${startTime}:00`);
    if (Number.isNaN(when.getTime())) {
      setError("That date and time isn't valid.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("create_player_match", {
      p_title: title.trim() || null,
      p_scheduled_at: when.toISOString(),
      p_min_players: MIN_PLAYERS,
      p_max_players: numOrNull(maxPlayers),
      p_price_eur: cfg.price,
    });
    setSaving(false);
    if (err || !data) {
      setError(err?.message || "Couldn't create the game.");
      // No phone on the account: open the add-phone popup so they can fix it here.
      if (err && /mobile number/i.test(err.message)) setPhonePrompt(true);
      return;
    }
    router.push(`/player-portal/games/${data}`);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
      <fieldset className="portal-card px-5 py-5">
        <legend className="px-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">When</legend>
        <AvailabilityPicker
          value={{ date, time: startTime }}
          onChange={(d, t) => { setDate(d); setStartTime(t); }}
          sessionHours={gameHours}
          bufferMinutes={cfg.bufferMinutes}
        />
        <p className="mt-3 text-[0.65rem] text-text-subtle">
          {endTime ? `Runs ${gameHours} hours, until ${endTime}.` : "Games run 3 hours - pick a date and start time we're open."}
        </p>
      </fieldset>

      <fieldset className="portal-card px-5 py-5">
        <legend className="px-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">Details</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <div className="mb-1.5 flex items-center justify-between">
              <label className={`${lbl} mb-0`}>Title</label>
              {titleDirty && (
                <button
                  type="button"
                  onClick={() => setTitleDirty(false)}
                  className="text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-text-subtle hover:text-accent"
                >
                  Reset to auto
                </button>
              )}
            </div>
            <input
              className={input}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleDirty(true);
              }}
              placeholder="Fills in from the date and times above"
            />
          </div>
          <div>
            <label className={lbl}>Max players (optional)</label>
            <input type="number" min="1" className={input} value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} onFocus={(e) => e.target.select()} placeholder="No cap" />
            <p className="mt-1 text-[0.65rem] text-text-subtle">Open games are €{cfg.price} per player and confirm once 10 sign up.</p>
          </div>
        </div>
      </fieldset>

      {error && <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-4">
        <Button type="submit" size="md" disabled={saving}>
          {saving ? "Creating…" : "Create game"}
        </Button>
        <p className="text-[0.65rem] text-text-subtle">You can have up to 3 active games at a time.</p>
      </div>

      {phonePrompt && (
        <AddPhoneModal
          onClose={() => setPhonePrompt(false)}
          onSaved={() => {
            setPhonePrompt(false);
            setError(null);
            router.refresh();
            submit();
          }}
        />
      )}
    </form>
  );
}
