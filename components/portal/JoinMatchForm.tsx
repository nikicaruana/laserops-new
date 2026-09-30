"use client";

/**
 * components/portal/JoinMatchForm.tsx
 * --------------------------------------------------------------------
 * A signed-up player joins a live match: enter the 4-digit code the marshal
 * calls out, their headband number, and pick a gun from their unlocked armory
 * (carousel). Defaults to the gun they booked at signup, if any. Calls the
 * join_live_match RPC, which verifies the code + signup + live status.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { GunCarousel, type CarouselGun } from "@/components/portal/GunCarousel";

const input =
  "h-12 w-full rounded-none border border-border bg-bg-overlay px-4 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

export function JoinMatchForm({
  matchId,
  guns,
  initial,
  bookedGun,
  isDoubleXp = false,
  boosts = { double: 0, one_five: 0 },
  preview = false,
}: {
  matchId: string;
  guns: CarouselGun[];
  initial: { headband: string | null; gun: string | null } | null;
  bookedGun: string | null;
  /** The match already grants double XP – boosts are then not usable. */
  isDoubleXp?: boolean;
  /** The player's remaining XP-boost balances. */
  boosts?: { double: number; one_five: number };
  /** Preview mode: render the flow without joining or spending a token. */
  preview?: boolean;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [headband, setHeadband] = useState(initial?.headband ?? "");
  const [gun, setGun] = useState(initial?.gun ?? bookedGun ?? guns[0]?.name ?? "");
  // Optional XP boost to apply at join. "none" | "double" | "one_five".
  const [boost, setBoost] = useState<"none" | "double" | "one_five">("none");
  const [boostNote, setBoostNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [taken, setTaken] = useState<string[]>([]);

  const hasBoosts = boosts.double > 0 || boosts.one_five > 0;

  const gunLabel = guns.find((g) => g.name === gun)?.label ?? gun;

  // Headband numbers already claimed by other players in this live match – a
  // heads-up so the player doesn't pick a taken one (the RPC rejects it anyway).
  const ownHeadband = (initial?.headband ?? "").trim();
  const loadTaken = useCallback(async () => {
    if (preview) {
      setTaken([]);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase.from("match_participants").select("headset_label").eq("match_id", matchId);
    const nums = ((data ?? []) as { headset_label: string | null }[])
      .map((r) => (r.headset_label ?? "").trim())
      .filter((h) => h !== "" && h !== ownHeadband);
    setTaken(Array.from(new Set(nums)));
  }, [matchId, ownHeadband, preview]);

  useEffect(() => {
    void loadTaken();
  }, [loadTaken]);

  const headbandTaken = headband.trim() !== "" && taken.includes(headband.trim());

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    if (preview) {
      setBusy(false);
      setBoostNote(boost !== "none" ? `${boost === "double" ? "Double XP" : "1.5x XP"} boost would be applied for this game.` : null);
      setJoined(true);
      return;
    }
    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("join_live_match", {
      p_match_id: matchId,
      p_code: code,
      p_headband: headband,
      p_gun: gun,
    });
    setBusy(false);
    const res = (data ?? {}) as { ok?: boolean; error?: string };
    if (err || !res.ok) {
      setError(res.error || err?.message || "Couldn't join. Try again.");
      void loadTaken(); // someone may have taken a number since page load
      return;
    }
    // Apply an XP boost if chosen (best-effort: joining still succeeds if this
    // fails, e.g. balance changed - we surface a note rather than block).
    if (boost !== "none" && !isDoubleXp) {
      const { data: mult, error: bErr } = await supabase.rpc("spend_xp_boost", { p_match_id: matchId, p_boost_type: boost });
      if (bErr) setBoostNote(`Couldn't apply your boost: ${bErr.message}`);
      else setBoostNote(`${Number(mult) === 2 ? "Double XP" : "1.5x XP"} boost applied for this game.`);
    }
    setJoined(true);
    router.refresh();
  }

  if (joined) {
    return (
      <div className="border border-accent bg-accent/10 px-5 py-6 text-center">
        <p className="text-lg font-bold uppercase tracking-[0.1em] text-accent">You&rsquo;re in!</p>
        <p className="mt-2 text-sm text-text-muted">
          Headband <span className="font-mono font-semibold text-text">{headband}</span>
          {gun && (
            <>
              {" "}
              · <span className="font-semibold text-text">{gunLabel}</span>
            </>
          )}
        </p>
        {boostNote && <p className="mt-3 text-xs font-semibold text-accent">{boostNote}</p>}
        <p className="mt-3 text-xs text-text-subtle">
          Good luck. Come back after the game to see your stats.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {preview && (
        <p className="border border-accent/50 bg-accent/10 px-3 py-2 text-[0.7rem] font-bold uppercase tracking-[0.08em] text-accent">
          Preview — nothing is really joined and no token is spent.
        </p>
      )}
      <div>
        <label className={lbl}>Entry code</label>
        <input
          inputMode="numeric"
          autoFocus
          maxLength={4}
          className={`${input} text-center text-2xl font-bold tracking-[0.5em]`}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="0000"
        />
        <p className="mt-1 text-[0.7rem] text-text-subtle">The 4-digit code the marshal calls out.</p>
      </div>

      <div>
        <label className={lbl}>Headband number</label>
        <input
          className={`${input} ${headbandTaken ? "border-red-700" : ""}`}
          value={headband}
          onChange={(e) => setHeadband(e.target.value)}
          placeholder="e.g. 07"
        />
        {headbandTaken ? (
          <p className="mt-1 text-[0.7rem] text-red-400">Headband {headband.trim()} is already taken – pick another.</p>
        ) : taken.length > 0 ? (
          <p className="mt-1 text-[0.7rem] text-text-subtle">Taken: {taken.join(", ")}</p>
        ) : null}
      </div>

      <div>
        <label className={lbl}>
          Your gun{bookedGun && gun === bookedGun ? " · booked" : ""}
        </label>
        {guns.length > 0 ? (
          <GunCarousel guns={guns} value={gun} onChange={setGun} />
        ) : (
          <input className={input} value={gun} onChange={(e) => setGun(e.target.value)} placeholder="Gun name" />
        )}
      </div>

      {/* XP boost: only when the player has one and the game isn't already double XP */}
      {isDoubleXp ? (
        hasBoosts && (
          <p className="border-l-2 border-accent/70 bg-accent/10 px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-accent">
            This game is already Double XP - your boosts are saved for another game.
          </p>
        )
      ) : hasBoosts ? (
        <div>
          <label className={lbl}>Use an XP boost?</label>
          <div className="flex flex-col gap-2">
            {([
              { key: "none", label: "No boost", avail: true },
              { key: "double", label: `Double XP (2x)${boosts.double > 0 ? ` · ${boosts.double} left` : ""}`, avail: boosts.double > 0 },
              { key: "one_five", label: `1.5x XP${boosts.one_five > 0 ? ` · ${boosts.one_five} left` : ""}`, avail: boosts.one_five > 0 },
            ] as const).map((opt) =>
              opt.avail ? (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setBoost(opt.key)}
                  className={`border px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.1em] transition-colors ${
                    boost === opt.key ? "border-accent bg-accent/10 text-accent" : "border-border-strong bg-bg-overlay/70 text-text-muted backdrop-blur-sm hover:border-accent hover:text-accent"
                  }`}
                >
                  {opt.label}
                </button>
              ) : null,
            )}
          </div>
          <p className="mt-1 text-[0.7rem] text-text-subtle">Applied to your XP for this game only. It&apos;s used up when you join.</p>
        </div>
      ) : null}

      {error && (
        <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      <Button type="submit" size="lg" disabled={busy || headbandTaken} className="w-full">
        {busy ? "Joining…" : "Join game"}
      </Button>
    </form>
  );
}
