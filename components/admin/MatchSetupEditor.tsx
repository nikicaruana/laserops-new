"use client";

/**
 * components/admin/MatchSetupEditor.tsx
 * --------------------------------------------------------------------
 * Edit a game's core setup after creation - the attributes the create form sets
 * but nothing could change afterwards: match type (open / double XP / private),
 * min & max players, and the beginners-only cap. Writes matches directly via the
 * admin RLS update (is_admin() policy), same as MatchLocationEditor. Title, date,
 * pricing and location each have their own editor; this fills the rest.
 *
 * Type is a composite of two columns: is_private + is_double_xp. Private games
 * are a direct booking, so they can't also be a public double-XP event or a
 * beginners game - picking Private clears both (mirrors CreateMatchForm).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

type MatchType = "open" | "double_xp" | "private";

const TYPE_META: Record<MatchType, { label: string; hint: string }> = {
  open: { label: "Open match", hint: "Public. Players sign up; confirms for sign-off once it hits the minimum." },
  double_xp: { label: "Double XP open match", hint: "Public open match where all XP is doubled." },
  private: { label: "Private booking", hint: "Not shown on the public games list - a direct booking." },
};

type GameStyle = "1v1_default" | "1v1v1_round_robin";

const STYLE_META: Record<GameStyle, { label: string; hint: string }> = {
  "1v1_default": { label: "1v1 default", hint: "Standard two-team game, one team against another. The default for all games." },
  "1v1v1_round_robin": { label: "1v1v1 round robin", hint: "Three teams play two at a time across the rounds; the team that wins the most rounds wins. All three team badges show on the report." },
};

const isGameStyle = (v: string | null): v is GameStyle => v === "1v1_default" || v === "1v1v1_round_robin";

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg-elevated px-3 text-sm text-text focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

function typeOf(isPrivate: boolean, isDoubleXp: boolean): MatchType {
  if (isPrivate) return "private";
  return isDoubleXp ? "double_xp" : "open";
}

export function MatchSetupEditor({
  matchId,
  isPrivate,
  isDoubleXp,
  gameStyle,
  minPlayers,
  maxPlayers,
  isBeginner,
  beginnerMaxLevel,
}: {
  matchId: string;
  isPrivate: boolean;
  isDoubleXp: boolean;
  gameStyle: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  isBeginner: boolean;
  beginnerMaxLevel: number | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [matchType, setMatchType] = useState<MatchType>(typeOf(isPrivate, isDoubleXp));
  const [styleVal, setStyleVal] = useState<GameStyle>(isGameStyle(gameStyle) ? gameStyle : "1v1_default");
  const [minVal, setMinVal] = useState(minPlayers != null ? String(minPlayers) : "");
  const [maxVal, setMaxVal] = useState(maxPlayers != null ? String(maxPlayers) : "");
  const [beginner, setBeginner] = useState(isBeginner);
  const [begMaxLevel, setBegMaxLevel] = useState(beginnerMaxLevel != null ? String(beginnerMaxLevel) : "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const privateType = matchType === "private";
  // Beginners cap is an open-game concept; private bookings can't use it.
  const showBeginner = !privateType;

  async function save() {
    setMsg(null);
    if (maxVal.trim() !== "" && minVal.trim() !== "" && Number(maxVal) < Number(minVal)) {
      return setMsg({ ok: false, text: "Max players can't be below min players." });
    }
    if (showBeginner && beginner && !(Number(begMaxLevel) > 0)) {
      return setMsg({ ok: false, text: "Set a max level for the beginners game." });
    }
    const beginnerOn = showBeginner && beginner;
    setBusy(true);
    const { error } = await supabase
      .from("matches")
      .update({
        is_private: privateType,
        is_double_xp: matchType === "double_xp",
        game_style: styleVal,
        min_players: minVal.trim() === "" ? null : Number(minVal),
        max_players: maxVal.trim() === "" ? null : Number(maxVal),
        is_beginner: beginnerOn,
        beginner_max_level: beginnerOn ? Number(begMaxLevel) || null : null,
      })
      .eq("id", matchId);
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: "Saved." });
    router.refresh();
  }

  return (
    <section className="mb-6 border border-border bg-bg-elevated p-5 sm:p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-accent">Game setup</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={lbl}>Game style</label>
          <select className={input} value={styleVal} onChange={(e) => setStyleVal(e.target.value as GameStyle)}>
            {(Object.keys(STYLE_META) as GameStyle[]).map((s) => (
              <option key={s} value={s}>{STYLE_META[s].label}</option>
            ))}
          </select>
          <p className="mt-1.5 text-[0.65rem] text-text-subtle">{STYLE_META[styleVal].hint}</p>
        </div>

        <div className="sm:col-span-2">
          <label className={lbl}>Match type</label>
          <select className={input} value={matchType} onChange={(e) => setMatchType(e.target.value as MatchType)}>
            {(Object.keys(TYPE_META) as MatchType[]).map((t) => (
              <option key={t} value={t}>{TYPE_META[t].label}</option>
            ))}
          </select>
          <p className="mt-1.5 text-[0.65rem] text-text-subtle">{TYPE_META[matchType].hint}</p>
        </div>

        <div>
          <label className={lbl}>{privateType ? "Expected players" : "Min players (quorum)"}</label>
          <input
            type="number"
            min="0"
            className={input}
            value={minVal}
            onChange={(e) => setMinVal(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder="e.g. 10"
          />
          {!privateType && (
            <p className="mt-1 text-[0.65rem] text-text-subtle">Confirms for admin sign-off once this many sign up.</p>
          )}
        </div>

        <div>
          <label className={lbl}>Max players (optional)</label>
          <input
            type="number"
            min="1"
            className={input}
            value={maxVal}
            onChange={(e) => setMaxVal(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder="No cap"
          />
        </div>

        {showBeginner && (
          <div className="sm:col-span-2 border-t border-border pt-4">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={beginner}
                onChange={(e) => setBeginner(e.target.checked)}
                className="h-4 w-4 accent-[color:var(--color-accent)]"
              />
              <span className="text-sm font-semibold text-text">Beginners only game</span>
            </label>
            <p className="mt-1 text-[0.65rem] text-text-subtle">
              Caps the game to players at or below a level. Higher-level players can&apos;t sign up.
            </p>
            {beginner && (
              <div className="mt-3 max-w-[14rem]">
                <label className={lbl}>Max level</label>
                <input
                  type="number"
                  min="1"
                  className={input}
                  value={begMaxLevel}
                  onChange={(e) => setBegMaxLevel(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="e.g. 10"
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center gap-4">
        <Button variant="secondary" size="md" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
        {msg && <p className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
      </div>
      <p className="mt-3 max-w-xl text-[0.65rem] text-text-subtle">
        Switching an open game to private removes it from the public games list; switching a private booking to open
        lists it for signups. Lifecycle status, title, date, pricing and location are edited separately.
      </p>
    </section>
  );
}
