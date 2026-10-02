"use client";

/**
 * components/admin/RefundConfigEditor.tsx
 * --------------------------------------------------------------------
 * Tunes the cancellation refund policy (refund_config): the automatic-refund
 * window, the no-refund window, and the player-facing policy text. Drives the
 * player cancel route (auto / pending / denied) and the policy shown before
 * paying. Saving requires a 2FA step-up (money-adjacent) and goes through the
 * admin-gated admin_set_refund_config RPC.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TotpGate } from "@/components/admin/TotpGate";
import { createClient } from "@/lib/supabase/client";

const input =
  "h-11 w-44 rounded-none border border-border-strong bg-bg-elevated px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const area =
  "min-h-[110px] w-full rounded-none border border-border-strong bg-bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted";

export function RefundConfigEditor({
  autoRefundHours,
  noRefundHours,
  policyText,
}: {
  autoRefundHours: number;
  noRefundHours: number;
  policyText: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [auto, setAuto] = useState(String(autoRefundHours));
  const [no, setNo] = useState(String(noRefundHours));
  const [text, setText] = useState(policyText);
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function start() {
    const a = Math.round(Number(auto));
    const n = Math.round(Number(no));
    if (!Number.isFinite(a) || a < 0) return setMsg({ ok: false, text: "Auto-refund hours must be 0 or more." });
    if (!Number.isFinite(n) || n < 0) return setMsg({ ok: false, text: "No-refund hours must be 0 or more." });
    if (a < n) return setMsg({ ok: false, text: "The automatic-refund window must be at least as large as the no-refund window." });
    if (text.trim() === "") return setMsg({ ok: false, text: "Enter the policy text players see." });
    setMsg(null);
    setGate(true);
  }

  async function confirm() {
    setGate(false);
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("admin_set_refund_config", {
      p_auto: Math.round(Number(auto)),
      p_no: Math.round(Number(no)),
      p_text: text,
    });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: "Saved." });
    router.refresh();
  }

  return (
    <section className="mb-6 border border-border bg-bg-elevated p-5 sm:p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-accent">Cancellation refund windows</h2>
      <div className="flex flex-wrap items-start gap-x-5 gap-y-4">
        <div>
          <label className={labelCls}>Automatic full refund (hours before)</label>
          <input className={input} type="number" min={0} value={auto} onChange={(e) => setAuto(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>No refund within (hours before)</label>
          <input className={input} type="number" min={0} value={no} onChange={(e) => setNo(e.target.value)} />
        </div>
      </div>

      <p className="mt-4 max-w-2xl text-xs text-text-subtle">
        Cancelling <span className="text-text">{auto || "?"}h</span> or more before the game is an automatic full refund.
        Between <span className="text-text">{no || "?"}h</span> and <span className="text-text">{auto || "?"}h</span> it
        is a refund by request (you approve it). Inside <span className="text-text">{no || "?"}h</span> it is
        non-refundable. (Admin early-end part-refunds of 25 / 50 / 75% are chosen per game in Match Manager, not here.)
      </p>

      <div className="mt-6">
        <label className={labelCls}>Policy text shown to players (before they pay)</label>
        <textarea className={area} value={text} onChange={(e) => setText(e.target.value)} />
        <p className="mt-1 text-[0.65rem] text-text-subtle">
          Keep the hours in this text in sync with the windows above.
        </p>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <Button variant="secondary" size="md" onClick={start} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
        {msg && <span className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</span>}
      </div>

      <TotpGate open={gate} action="the refund policy" onCancel={() => setGate(false)} onVerified={confirm} />
    </section>
  );
}
