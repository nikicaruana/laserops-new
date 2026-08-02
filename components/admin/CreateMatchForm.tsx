"use client";

/**
 * components/admin/CreateMatchForm.tsx
 * --------------------------------------------------------------------
 * Admin match creator. A type dropdown drives everything:
 *   open match          -> public, tentative (awaiting signups)
 *   double XP open match -> public, tentative, double XP
 *   private booking     -> not public, created already confirmed
 * Setup order: type -> date (calendar) -> start time (30-min dropdown,
 * 08:00-21:00) -> end time (auto +3h, editable) -> title (auto from those,
 * editable). Inserts a matches row; match_code + created_by come from a DB
 * trigger. Only the start (scheduled_at) is stored; end time feeds the title.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

type MatchType = "open" | "double_xp" | "private";

const TYPE_META: Record<MatchType, { label: string; titlePrefix: string; hint: string }> = {
  open: {
    label: "Open match",
    titlePrefix: "Open Match",
    hint: "Public. Players sign up; confirms for your sign-off once it hits the minimum.",
  },
  double_xp: {
    label: "Double XP open match",
    titlePrefix: "Double XP Match",
    hint: "Public open match where all XP is doubled.",
  },
  private: {
    label: "Private booking",
    titlePrefix: "Private Booking",
    hint: "Not shown on the public games list. Created already confirmed (a direct booking).",
  },
};

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";
const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

const fmtMins = (mins: number) => {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
// Start: 08:00 -> 21:00. End: 08:30 -> 24:00 (shown as 00:00) so 21:00 + 3h works.
const START_OPTIONS = Array.from({ length: (1260 - 480) / 30 + 1 }, (_, i) => fmtMins(480 + i * 30));
const END_OPTIONS = Array.from({ length: (1440 - 510) / 30 + 1 }, (_, i) => fmtMins(510 + i * 30));
const addHours = (hhmm: string, hrs: number) => {
  const [h, m] = hhmm.split(":").map(Number);
  return fmtMins((h * 60 + m + hrs * 60) % 1440);
};

export function CreateMatchForm() {
  const router = useRouter();
  const [matchType, setMatchType] = useState<MatchType>("open");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [endDirty, setEndDirty] = useState(false);
  const [title, setTitle] = useState("");
  const [titleDirty, setTitleDirty] = useState(false);
  const [minPlayers, setMinPlayers] = useState("10");
  const [maxPlayers, setMaxPlayers] = useState("");
  const [priceEur, setPriceEur] = useState("");
  const [pricingMode, setPricingMode] = useState<"per_player" | "flat">("per_player");
  const [depositEur, setDepositEur] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPrivate = matchType === "private";
  // Only private bookings can be a flat lump sum; everything else is per player.
  const effectiveMode = isPrivate ? pricingMode : "per_player";
  const priceLabel = effectiveMode === "flat" ? "Flat rate (EUR)" : "Price per player (EUR, optional)";

  // Auto-generate the title from the setup params until the admin edits it.
  useEffect(() => {
    if (titleDirty) return;
    if (!date || !startTime || !endTime) {
      setTitle("");
      return;
    }
    const [y, m, d] = date.split("-");
    setTitle(`${TYPE_META[matchType].titlePrefix} - ${d}/${m}/${y} ${startTime} - ${endTime}`);
  }, [date, startTime, endTime, matchType, titleDirty]);

  function onStart(v: string) {
    setStartTime(v);
    if (!endDirty && v) setEndTime(addHours(v, 3));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!date || !startTime) {
      setError("Pick a date and start time.");
      return;
    }
    const when = new Date(`${date}T${startTime}:00`);
    if (Number.isNaN(when.getTime())) {
      setError("That date/time isn't valid.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("matches")
      .insert({
        title: title.trim() || null,
        scheduled_at: when.toISOString(),
        status: isPrivate ? "confirmed" : "tentative",
        min_players: Number(minPlayers) || (isPrivate ? 0 : 10),
        max_players: numOrNull(maxPlayers),
        price_eur: numOrNull(priceEur),
        pricing_mode: effectiveMode,
        deposit_eur: isPrivate ? numOrNull(depositEur) : null,
        is_double_xp: matchType === "double_xp",
        is_private: isPrivate,
      })
      .select("id")
      .single();
    setSaving(false);
    if (err || !data) {
      setError(err?.message || "Couldn't create the match.");
      return;
    }
    router.push(`/admin/matches/${data.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
      <fieldset className="border border-border bg-bg-elevated px-5 py-5">
        <legend className="px-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">
          Match type
        </legend>
        <select
          className={input}
          value={matchType}
          onChange={(e) => setMatchType(e.target.value as MatchType)}
        >
          {(Object.keys(TYPE_META) as MatchType[]).map((t) => (
            <option key={t} value={t}>{TYPE_META[t].label}</option>
          ))}
        </select>
        <p className="mt-1.5 text-[0.65rem] text-text-subtle">{TYPE_META[matchType].hint}</p>
      </fieldset>

      <fieldset className="border border-border bg-bg-elevated px-5 py-5">
        <legend className="px-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">
          When
        </legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label className={lbl}>Date</label>
            <input
              type="date"
              className={`${input} [color-scheme:dark]`}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onClick={(e) => e.currentTarget.showPicker?.()}
            />
          </div>
          <div>
            <label className={lbl}>Start time</label>
            <select className={input} value={startTime} onChange={(e) => onStart(e.target.value)}>
              <option value="">Select…</option>
              {START_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>End time</label>
            <select
              className={input}
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                setEndDirty(true);
              }}
            >
              <option value="">Select…</option>
              {END_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <p className="mt-1 text-[0.65rem] text-text-subtle">Defaults to 3 hours after the start.</p>
          </div>
        </div>
      </fieldset>

      <fieldset className="border border-border bg-bg-elevated px-5 py-5">
        <legend className="px-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">
          Details
        </legend>
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
              placeholder="Fills in from the type, date and times above"
            />
          </div>
          <div>
            <label className={lbl}>{isPrivate ? "Expected players" : "Min players (quorum)"}</label>
            <input type="number" min="0" className={input} value={minPlayers} onChange={(e) => setMinPlayers(e.target.value)} onFocus={(e) => e.target.select()} />
            {!isPrivate && (
              <p className="mt-1 text-[0.65rem] text-text-subtle">Confirms for admin sign-off once this many sign up.</p>
            )}
          </div>
          <div>
            <label className={lbl}>Max players (optional)</label>
            <input type="number" min="1" className={input} value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} onFocus={(e) => e.target.select()} placeholder="No cap" />
          </div>

          {isPrivate && (
            <div>
              <label className={lbl}>Pricing</label>
              <select className={input} value={pricingMode} onChange={(e) => setPricingMode(e.target.value as "per_player" | "flat")}>
                <option value="per_player">Per player</option>
                <option value="flat">Flat rate (lump sum)</option>
              </select>
            </div>
          )}
          <div>
            <label className={lbl}>{priceLabel}</label>
            <input type="number" step="0.01" min="0" className={input} value={priceEur} onChange={(e) => setPriceEur(e.target.value)} onFocus={(e) => e.target.select()} placeholder={effectiveMode === "flat" ? "e.g. 300" : "e.g. 15"} />
          </div>
          {isPrivate && (
            <div>
              <label className={lbl}>Deposit (EUR, optional)</label>
              <input type="number" step="0.01" min="0" className={input} value={depositEur} onChange={(e) => setDepositEur(e.target.value)} onFocus={(e) => e.target.select()} placeholder="e.g. 50" />
              <p className="mt-1 text-[0.65rem] text-text-subtle">A deposit payment link can be generated later.</p>
            </div>
          )}
        </div>
      </fieldset>

      {error && (
        <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      <Button type="submit" size="md" disabled={saving}>
        {saving ? "Creating…" : "Create match"}
      </Button>
    </form>
  );
}
