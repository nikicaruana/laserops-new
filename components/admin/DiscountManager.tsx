"use client";

/**
 * components/admin/DiscountManager.tsx
 * --------------------------------------------------------------------
 * Admin UI for permanent "family & friends" pricing: a player pays a HARD-CODED
 * per-player game fee instead of the normal price. Set a fixed price by ops tag,
 * and edit or remove existing ones. Every change requires a 2FA step-up
 * (TotpGate) and goes through the admin-gated admin_set_player_price RPC (null
 * price = remove).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TotpGate } from "@/components/admin/TotpGate";
import { createClient } from "@/lib/supabase/client";
import { formatEur } from "@/lib/money";

type Row = { id: string; opsTag: string; price: number };

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg-elevated px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted";

export function DiscountManager({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const supabase = createClient();

  const [opsTag, setOpsTag] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // pending = the change awaiting 2FA. price null => remove the discount.
  const [gate, setGate] = useState<{ acctId: string; opsTag: string; price: number | null } | null>(null);

  async function start() {
    setBusy(true);
    setMsg(null);
    const tag = opsTag.trim();
    const priceN = Number(price);
    if (!tag || !Number.isFinite(priceN) || priceN < 0) {
      setBusy(false);
      setMsg({ ok: false, text: "Enter an ops tag and a price (0 or more)." });
      return;
    }
    const { data: acct } = await supabase.from("accounts").select("id, ops_tag").ilike("ops_tag", tag).maybeSingle();
    setBusy(false);
    if (!acct) {
      setMsg({ ok: false, text: `No player found with ops tag “${tag}”.` });
      return;
    }
    setGate({ acctId: acct.id, opsTag: acct.ops_tag ?? tag, price: priceN });
  }

  async function confirm() {
    if (!gate) return;
    const g = gate;
    setGate(null);
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("admin_set_player_price", { p_acct: g.acctId, p_price: g.price });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    setMsg({ ok: true, text: g.price == null ? `Removed the discount for ${g.opsTag}.` : `Set ${g.opsTag} to ${formatEur(g.price)} per game.` });
    setOpsTag("");
    setPrice("");
    router.refresh();
  }

  function editRow(r: Row) {
    setOpsTag(r.opsTag);
    setPrice(String(r.price));
    setMsg(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div>
      <section className="mb-6 border border-border bg-bg-elevated p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-accent">Set a fixed price</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className={labelCls}>Player ops tag</label>
            <input className={input} value={opsTag} onChange={(e) => setOpsTag(e.target.value)} placeholder="e.g. Kini" />
          </div>
          <div className="sm:col-span-1">
            <label className={labelCls}>Their price (€ per game)</label>
            <input
              className={input}
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 20"
            />
          </div>
          <div className="flex items-end">
            <Button variant="primary" size="md" onClick={start} disabled={busy}>
              {busy ? "Working…" : "Apply price"}
            </Button>
          </div>
        </div>
        {msg && <p className={`mt-3 text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
        <p className="mt-3 text-xs text-text-subtle">
          A permanent, fixed per-player game fee for this player, replacing the normal price (they still pay it after any
          tokens). Use the Remove button to clear it. Changes require two-factor authentication.
        </p>
      </section>

      <section className="border border-border bg-bg-elevated p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-accent">Current fixed prices</h2>
        {initial.length === 0 ? (
          <p className="text-sm text-text-muted">No players have a fixed price yet.</p>
        ) : (
          <div className="overflow-x-auto border border-border">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-bg">
                  <th className="px-3 py-2 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-subtle">Player</th>
                  <th className="px-3 py-2 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-subtle">Price / game</th>
                  <th className="px-3 py-2 text-right text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-subtle">Actions</th>
                </tr>
              </thead>
              <tbody>
                {initial.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="px-3 py-2 font-semibold text-text">{r.opsTag}</td>
                    <td className="px-3 py-2 text-accent">{formatEur(r.price)}</td>
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
                        onClick={() => setGate({ acctId: r.id, opsTag: r.opsTag, price: null })}
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
          gate
            ? gate.price == null
              ? `remove ${gate.opsTag}'s fixed price`
              : `set ${gate.opsTag} to ${formatEur(gate.price)} per game`
            : "this change"
        }
        onCancel={() => setGate(null)}
        onVerified={confirm}
      />
    </div>
  );
}
