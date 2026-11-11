"use client";

/**
 * components/admin/VoucherManager.tsx
 * --------------------------------------------------------------------
 * Mint and manage printable prize vouchers. Each voucher is a token_gift worth
 * N game tokens, redeemed by scanning a QR that opens /player-portal/claim (sign
 * up / in first if needed, then granted once). Generate a batch, download the
 * print-ready PDF (two-sided yellow cards, 3 per A4 — duplex, flip on long edge),
 * and void a batch's unclaimed vouchers if a sheet is lost. Minting and voiding
 * step up through 2FA, like the other
 * value-affecting token actions.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TotpGate } from "@/components/admin/TotpGate";
import { createClient } from "@/lib/supabase/client";

export type VoucherBatch = {
  batch_label: string;
  total: number;
  unclaimed: number;
  claimed: number;
  voided: number;
  tokens_each: number;
  last_created: string | null;
};

const input = "h-10 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";
}
const pdfHref = (label: string) => `/api/admin/vouchers/pdf?label=${encodeURIComponent(label)}`;

export function VoucherManager({ initialBatches }: { initialBatches: VoucherBatch[] }) {
  const router = useRouter();
  const supabase = createClient();

  const [count, setCount] = useState("20");
  const [tokens, setTokens] = useState("1");
  const [validity, setValidity] = useState("12");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [gate, setGate] = useState<{ action: string; run: () => void | Promise<void> } | null>(null);

  async function mint() {
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.rpc("admin_mint_token_vouchers", {
      p_count: Number(count),
      p_tokens: Number(tokens) || 1,
      p_validity_months: Number(validity) || 12,
      p_label: label.trim() || null,
    });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    const rows = (data ?? []) as { id: string; claim_code: string }[];
    setMsg({ ok: true, text: `Minted ${rows.length} voucher${rows.length === 1 ? "" : "s"}. Opening the printable PDF…` });
    // Download the freshly minted set by id (exact, even before the list refreshes).
    const ids = rows.map((r) => r.id).join(",");
    if (ids) window.open(`/api/admin/vouchers/pdf?ids=${encodeURIComponent(ids)}`, "_blank");
    router.refresh();
  }

  async function voidBatch(b: VoucherBatch) {
    if (b.batch_label === "(no label)") {
      return setMsg({ ok: false, text: "Only labelled batches can be voided in bulk (to avoid voiding the wrong ones)." });
    }
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.rpc("admin_void_voucher_batch", { p_label: b.batch_label });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: `Voided ${Number(data) || 0} unclaimed voucher${Number(data) === 1 ? "" : "s"} in “${b.batch_label}”.` });
    router.refresh();
  }

  const canMint = Number(count) >= 1 && Number(count) <= 500;

  return (
    <section className="mb-8 border border-border bg-bg-elevated p-5 sm:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-accent">Prize vouchers</h2>
      <p className="mt-2 max-w-2xl text-xs text-text-subtle">
        Printable vouchers for giveaways. Each is worth the tokens you set and is claimed by scanning its QR code
        (the recipient signs up first if they&rsquo;re new, then the token lands in their account). These are free
        tokens — no payment is recorded.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-4">
        <div>
          <label className={lbl}>How many</label>
          <input type="number" min="1" max="500" className={input} value={count} onChange={(e) => setCount(e.target.value)} onFocus={(e) => e.target.select()} />
        </div>
        <div>
          <label className={lbl}>Tokens each</label>
          <input type="number" min="0.5" step="0.5" className={input} value={tokens} onChange={(e) => setTokens(e.target.value)} onFocus={(e) => e.target.select()} />
        </div>
        <div>
          <label className={lbl}>Valid for (months)</label>
          <input type="number" min="1" className={input} value={validity} onChange={(e) => setValidity(e.target.value)} onFocus={(e) => e.target.select()} />
        </div>
        <div>
          <label className={lbl}>Batch label</label>
          <input className={input} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Welbee's staff prizes" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <Button
          variant="primary"
          size="md"
          disabled={busy || !canMint}
          onClick={() => setGate({ action: `generate ${count} prize voucher${Number(count) === 1 ? "" : "s"}`, run: mint })}
        >
          {busy ? "Working…" : "Generate & download PDF"}
        </Button>
        {msg && <p className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
      </div>
      <p className="mt-2 text-[0.65rem] text-text-subtle">A label lets you reprint or void the whole batch later. Give each batch its own label.</p>

      {/* Existing batches */}
      <div className="mt-7">
        <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-text-subtle">Batches</p>
        {initialBatches.length === 0 ? (
          <p className="border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">No vouchers minted yet.</p>
        ) : (
          <div className="overflow-x-auto border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-bg text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
                  <th className="px-4 py-2.5 font-semibold">Batch</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Tokens</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Unclaimed</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Claimed</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Void</th>
                  <th className="px-3 py-2.5 font-semibold">Created</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {initialBatches.map((b) => (
                  <tr key={b.batch_label} className="border-b border-border/60 last:border-0 align-middle">
                    <td className="px-4 py-2.5 font-semibold text-text">{b.batch_label}
                      <span className="ml-2 text-[0.7rem] font-normal text-text-subtle">{b.total} total</span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-text-muted">{b.tokens_each}</td>
                    <td className="px-3 py-2.5 text-center font-semibold text-emerald-300">{b.unclaimed}</td>
                    <td className="px-3 py-2.5 text-center text-text-muted">{b.claimed}</td>
                    <td className="px-3 py-2.5 text-center text-text-subtle">{b.voided || "—"}</td>
                    <td className="px-3 py-2.5 text-text-muted">{fmtDate(b.last_created)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-3">
                        <a href={pdfHref(b.batch_label)} target="_blank" rel="noopener" className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-accent hover:text-accent-soft">
                          PDF (unclaimed)
                        </a>
                        {b.unclaimed > 0 && b.batch_label !== "(no label)" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setGate({ action: `void the ${b.unclaimed} unclaimed voucher${b.unclaimed === 1 ? "" : "s"} in “${b.batch_label}”`, run: () => voidBatch(b) })}
                            className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-text-subtle hover:text-red-400 disabled:opacity-50"
                          >
                            Void unclaimed
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TotpGate
        open={gate != null}
        action={gate?.action ?? ""}
        onCancel={() => setGate(null)}
        onVerified={async () => { const g = gate; setGate(null); if (g) await g.run(); }}
      />
    </section>
  );
}
