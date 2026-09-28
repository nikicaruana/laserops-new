"use client";

/**
 * components/admin/PricingConfigEditor.tsx
 * --------------------------------------------------------------------
 * Session & booking defaults: the normal per-player game price, the session
 * length (minutes), and the enforced break between bookings (minutes). Drives
 * open-game creation + the booking availability/clash checks. Saving requires a
 * 2FA step-up and goes through the admin-gated admin_set_pricing_config RPC.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TotpGate } from "@/components/admin/TotpGate";
import { createClient } from "@/lib/supabase/client";

const input =
  "h-11 w-44 rounded-none border border-border-strong bg-bg-elevated px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted";

function hoursHint(minsStr: string): string {
  const n = Math.round(Number(minsStr));
  if (!Number.isFinite(n) || n <= 0) return " ";
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `= ${[h ? `${h}h` : "", m ? `${m}m` : ""].filter(Boolean).join(" ") || "0m"}`;
}

export function PricingConfigEditor({
  price,
  sessionMinutes,
  bufferMinutes,
}: {
  price: number;
  sessionMinutes: number;
  bufferMinutes: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [p, setP] = useState(String(price));
  const [sm, setSm] = useState(String(sessionMinutes));
  const [bm, setBm] = useState(String(bufferMinutes));
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function start() {
    const priceN = Number(p);
    const smN = Math.round(Number(sm));
    const bmN = Math.round(Number(bm));
    if (!Number.isFinite(priceN) || priceN < 0) return setMsg({ ok: false, text: "Enter a valid price." });
    if (!Number.isFinite(smN) || smN <= 0) return setMsg({ ok: false, text: "Session length must be positive." });
    if (!Number.isFinite(bmN) || bmN < 0) return setMsg({ ok: false, text: "Break must be 0 or more." });
    setMsg(null);
    setGate(true);
  }

  async function confirm() {
    setGate(false);
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("admin_set_pricing_config", {
      p_price: Number(p),
      p_session_minutes: Math.round(Number(sm)),
      p_buffer_minutes: Math.round(Number(bm)),
    });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    setMsg({ ok: true, text: "Saved." });
    router.refresh();
  }

  return (
    <section className="mb-6 border border-border bg-bg-elevated p-5 sm:p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-accent">Session &amp; booking defaults</h2>
      <div className="flex flex-wrap items-start gap-x-5 gap-y-4">
        <div>
          <label className={labelCls}>Normal price (€ per player)</label>
          <input className={input} type="number" min={0} step="0.01" value={p} onChange={(e) => setP(e.target.value)} />
          <p className="mt-1 text-[0.65rem] text-text-subtle">&nbsp;</p>
        </div>
        <div>
          <label className={labelCls}>Session length (minutes)</label>
          <input className={input} type="number" min={1} value={sm} onChange={(e) => setSm(e.target.value)} />
          <p className="mt-1 text-[0.65rem] text-text-subtle">{hoursHint(sm)}</p>
        </div>
        <div>
          <label className={labelCls}>Break between bookings (minutes)</label>
          <input className={input} type="number" min={0} value={bm} onChange={(e) => setBm(e.target.value)} />
          <p className="mt-1 text-[0.65rem] text-text-subtle">{hoursHint(bm)}</p>
        </div>
        <div>
          <label className={labelCls} aria-hidden>
            &nbsp;
          </label>
          <Button variant="secondary" size="md" onClick={start} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
      {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
      <p className="mt-3 max-w-2xl text-xs text-text-subtle">
        The normal price applies to new open games. The session length sets how long a game runs (and the latest start
        that still finishes before closing), and the break is the gap enforced between one booking finishing and the next
        starting. Changes require two-factor authentication and apply to new bookings.
      </p>

      <TotpGate open={gate} action="the pricing & session settings" onCancel={() => setGate(false)} onVerified={confirm} />
    </section>
  );
}
