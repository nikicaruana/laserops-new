"use client";

/**
 * components/admin/DiscountManager.tsx
 * --------------------------------------------------------------------
 * Admin UI for permanent "family & friends" per-account discounts. Set a
 * player's discount (0-100% off their per-player game fee) by ops tag, and edit
 * or remove existing ones. Every change requires a 2FA step-up (TotpGate) and
 * goes through the admin-gated admin_set_player_discount RPC.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TotpGate } from "@/components/admin/TotpGate";
import { createClient } from "@/lib/supabase/client";

type Row = { id: string; opsTag: string; discountPct: number };

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg-elevated px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted";

export function DiscountManager({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const supabase = createClient();

  const [opsTag, setOpsTag] = useState("");
  const [pct, setPct] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [gate, setGate] = useState<{ acctId: string; opsTag: string; pct: number } | null>(null);

  async function start() {
    setBusy(true);
    setMsg(null);
    const tag = opsTag.trim();
    const p = Math.round(Number(pct));
    if (!tag || !Number.isFinite(p) || p < 0 || p > 100) {
      setBusy(false);
      setMsg({ ok: false, text: "Enter an ops tag and a discount between 0 and 100." });
      return;
    }
    const { data: acct } = await supabase.from("accounts").select("id, ops_tag").ilike("ops_tag", tag).maybeSingle();
    setBusy(false);
    if (!acct) {
      setMsg({ ok: false, text: `No player found with ops tag “${tag}”.` });
      return;
    }
    setGate({ acctId: acct.id, opsTag: acct.ops_tag ?? tag, pct: p });
  }

  async function confirm() {
    if (!gate) return;
    const g = gate;
    setGate(null);
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("admin_set_player_discount", { p_acct: g.acctId, p_pct: g.pct });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    setMsg({ ok: true, text: g.pct > 0 ? `Set ${g.opsTag} to ${g.pct}% off.` : `Removed the discount for ${g.opsTag}.` });
    setOpsTag("");
    setPct("");
    router.refresh();
  }

  function editRow(r: Row) {
    setOpsTag(r.opsTag);
    setPct(String(r.discountPct));
    setMsg(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div>
      <section className="mb-6 border border-border bg-bg-elevated p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-accent">Set a discount</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className={labelCls}>Player ops tag</label>
            <input className={input} value={opsTag} onChange={(e) => setOpsTag(e.target.value)} placeholder="e.g. Kini" />
          </div>
          <div className="sm:col-span-1">
            <label className={labelCls}>Discount (% off)</label>
            <input
              className={input}
              type="number"
              min={0}
              max={100}
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              placeholder="e.g. 50"
            />
          </div>
          <div className="flex items-end">
            <Button variant="primary" size="md" onClick={start} disabled={busy}>
              {busy ? "Working…" : "Apply discount"}
            </Button>
          </div>
        </div>
        {msg && <p className={`mt-3 text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
        <p className="mt-3 text-xs text-text-subtle">
          A permanent percentage off the player&apos;s per-player game fee (the cash they pay after any tokens). Set 0 to
          remove it. Changes require two-factor authentication.
        </p>
      </section>

      <section className="border border-border bg-bg-elevated p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-accent">Current discounts</h2>
        {initial.length === 0 ? (
          <p className="text-sm text-text-muted">No players have a discount yet.</p>
        ) : (
          <div className="overflow-x-auto border border-border">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-bg">
                  <th className="px-3 py-2 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-subtle">Player</th>
                  <th className="px-3 py-2 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-subtle">Discount</th>
                  <th className="px-3 py-2 text-right text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-subtle">Actions</th>
                </tr>
              </thead>
              <tbody>
                {initial.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="px-3 py-2 font-semibold text-text">{r.opsTag}</td>
                    <td className="px-3 py-2 text-accent">{r.discountPct}% off</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => editRow(r)}
                        className="px-2 text-xs font-semibold uppercase tracking-[0.1em] text-text-muted hover:text-accent"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setGate({ acctId: r.id, opsTag: r.opsTag, pct: 0 })}
                        disabled={busy}
                        className="ml-2 px-2 text-xs font-semibold uppercase tracking-[0.1em] text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <TotpGate
        open={gate !== null}
        action={
          gate ? (gate.pct > 0 ? `set ${gate.opsTag} to ${gate.pct}% off` : `remove ${gate.opsTag}'s discount`) : "this change"
        }
        onCancel={() => setGate(null)}
        onVerified={confirm}
      />
    </div>
  );
}
