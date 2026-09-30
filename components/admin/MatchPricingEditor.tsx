"use client";

/**
 * components/admin/MatchPricingEditor.tsx
 * --------------------------------------------------------------------
 * Admin (re)pricing for one game: choose the pricing mode (per-player online vs
 * flat offline), the price, and an optional deposit. Mainly for player-requested
 * private bookings, which arrive as flat + unpriced for the admin to price at
 * confirm time. Saving requires a 2FA step-up (TotpGate) and goes through the
 * admin-gated admin_set_match_pricing RPC.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TotpGate } from "@/components/admin/TotpGate";
import { createClient } from "@/lib/supabase/client";

const input =
  "h-11 w-44 rounded-none border border-border-strong bg-bg-elevated px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted";

export function MatchPricingEditor({
  matchId,
  price,
  pricingMode,
  deposit,
}: {
  matchId: string;
  price: number | null;
  pricingMode: string | null;
  deposit: number | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"per_player" | "flat">(pricingMode === "flat" ? "flat" : "per_player");
  const [p, setP] = useState(price != null ? String(price) : "");
  const [dep, setDep] = useState(deposit != null ? String(deposit) : "");
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function start() {
    const priceN = p.trim() === "" ? null : Number(p);
    if (priceN != null && (!Number.isFinite(priceN) || priceN < 0)) return setMsg({ ok: false, text: "Enter a valid price." });
    if (mode === "per_player" && !(Number(priceN) > 0)) return setMsg({ ok: false, text: "Per-player pricing needs a price above 0." });
    const depN = dep.trim() === "" ? null : Number(dep);
    if (depN != null && (!Number.isFinite(depN) || depN < 0)) return setMsg({ ok: false, text: "Enter a valid deposit." });
    setMsg(null);
    setGate(true);
  }

  async function confirm() {
    setGate(false);
    setBusy(true);
    setMsg(null);
    const priceN = p.trim() === "" ? null : Number(p);
    const depN = dep.trim() === "" ? null : Number(dep);
    const { error } = await supabase.rpc("admin_set_match_pricing", {
      p_match_id: matchId,
      p_price: priceN,
      p_pricing_mode: mode,
      p_deposit: depN,
    });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    setMsg({ ok: true, text: "Pricing updated." });
    router.refresh();
  }

  return (
    <section className="mb-8 border border-border bg-bg-elevated p-5 sm:p-6">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-[0.12em] text-accent">Pricing</h2>
      <p className="mb-4 max-w-2xl text-xs text-text-subtle">
        Set how this game is paid. <span className="text-text">Per player</span> lets each player pay online (token or
        card) or offline; <span className="text-text">flat rate</span> is a single lump sum settled offline. Changes
        require two-factor authentication.
      </p>
      <div className="flex flex-wrap items-start gap-x-5 gap-y-4">
        <div>
          <label className={labelCls}>Pricing mode</label>
          <select className={input} value={mode} onChange={(e) => setMode(e.target.value as "per_player" | "flat")}>
            <option value="per_player">Per player (online)</option>
            <option value="flat">Flat rate (offline)</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>{mode === "flat" ? "Flat rate (€)" : "Price per player (€)"}</label>
          <input className={input} type="number" min={0} step="0.01" value={p} onChange={(e) => setP(e.target.value)} placeholder={mode === "flat" ? "e.g. 350" : "e.g. 35"} />
        </div>
        <div>
          <label className={labelCls}>Deposit (€, optional)</label>
          <input className={input} type="number" min={0} step="0.01" value={dep} onChange={(e) => setDep(e.target.value)} placeholder="e.g. 50" />
        </div>
        <div>
          <label className={labelCls} aria-hidden>
            &nbsp;
          </label>
          <Button variant="secondary" size="md" onClick={start} disabled={busy}>
            {busy ? "Saving…" : "Save pricing"}
          </Button>
        </div>
      </div>
      {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}

      <TotpGate open={gate} action="this game's pricing" onCancel={() => setGate(false)} onVerified={confirm} />
    </section>
  );
}
