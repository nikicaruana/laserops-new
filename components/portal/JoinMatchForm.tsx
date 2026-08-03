"use client";

/**
 * components/portal/JoinMatchForm.tsx
 * --------------------------------------------------------------------
 * A signed-up player joins a live match: enter the 4-digit code the marshal
 * calls out, their headband number, and the gun they're using (from their
 * unlocked armory). Calls the join_live_match RPC, which verifies the code +
 * signup + live status server-side. On success shows a confirmation.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

const input =
  "h-12 w-full rounded-none border border-border-strong bg-bg-elevated px-4 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

export function JoinMatchForm({
  matchId,
  guns,
  initial,
}: {
  matchId: string;
  guns: string[];
  initial: { headband: string | null; gun: string | null } | null;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [headband, setHeadband] = useState(initial?.headband ?? "");
  const [gun, setGun] = useState(initial?.gun ?? (guns[0] ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
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
      return;
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
              · <span className="font-semibold text-text">{gun}</span>
            </>
          )}
        </p>
        <p className="mt-3 text-xs text-text-subtle">
          Good luck. Come back after the game to see your stats.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
          className={input}
          value={headband}
          onChange={(e) => setHeadband(e.target.value)}
          placeholder="e.g. 07"
        />
      </div>

      <div>
        <label className={lbl}>Your gun</label>
        {guns.length > 0 ? (
          <select className={input} value={gun} onChange={(e) => setGun(e.target.value)}>
            {guns.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        ) : (
          <input
            className={input}
            value={gun}
            onChange={(e) => setGun(e.target.value)}
            placeholder="Gun name"
          />
        )}
        {guns.length > 0 && (
          <p className="mt-1 text-[0.7rem] text-text-subtle">Pick from the guns you&rsquo;ve unlocked.</p>
        )}
      </div>

      {error && (
        <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      <Button type="submit" size="lg" disabled={busy} className="w-full">
        {busy ? "Joining…" : "Join game"}
      </Button>
    </form>
  );
}
