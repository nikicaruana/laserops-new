"use client";

/**
 * components/admin/TokenGiftRequests.tsx
 * --------------------------------------------------------------------
 * "Token Gift Requests" - a player wants to gift a game token (or half) to
 * another player. No online payment, so we collect it from the buyer by hand.
 * Each row shows the buyer (who pays, with contact details), the recipient (who
 * gets the token), the amount, price and their message. Fulfil (behind 2FA, like
 * all token grants) credits the recipient, records the money, and notifies them.
 * Decline closes the request.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TotpGate } from "@/components/admin/TotpGate";
import { formatEur } from "@/lib/money";

type Req = {
  id: string;
  tokens: number;
  price_eur: number;
  message: string | null;
  created_at: string;
  buyer: { ops_tag: string | null; full_name: string | null; email: string | null; phone: string | null } | null;
  recipient: { ops_tag: string | null; full_name: string | null } | null;
};

const fmtTokens = (n: number) => (Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(2))));

export function TokenGiftRequests({ initial }: { initial: Req[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Req[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<Record<string, string>>({});
  const [gateFor, setGateFor] = useState<{ req: Req; method: string } | null>(null);

  function startFulfil(r: Req) {
    setError(null);
    setGateFor({ req: r, method: method[r.id] ?? "cash" });
  }

  async function runFulfil() {
    const g = gateFor;
    if (!g) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("admin_fulfil_token_gift_request", {
      p_request_id: g.req.id,
      p_method: g.method === "none" ? null : g.method,
    });
    setBusy(false);
    setGateFor(null);
    if (err) return setError(err.message);
    setRows((prev) => prev.filter((x) => x.id !== g.req.id));
    router.refresh();
  }

  async function decline(r: Req) {
    if (!window.confirm(`Decline ${r.buyer?.ops_tag || "this player"}'s gift to ${r.recipient?.ops_tag || "the recipient"}?`)) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("admin_decline_token_gift_request", { p_request_id: r.id, p_note: null });
    setBusy(false);
    if (err) return setError(err.message);
    setRows((prev) => prev.filter((x) => x.id !== r.id));
    router.refresh();
  }

  return (
    <section className="mb-8">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-[0.12em] text-accent">
        Token Gift Requests <span className="text-text-muted">({rows.length})</span>
      </h2>
      <p className="mb-3 text-xs text-text-muted">
        A player wants to gift a token to another player. Collect payment from the <span className="font-semibold text-text">buyer</span> (cash or
        Revolut), pick the method so it lands on the financial reports, then Fulfil to grant the token to the recipient
        and notify them (you&apos;ll confirm with 2FA).
      </p>

      {error && <p className="mb-3 border border-red-800 bg-red-950/40 px-4 py-2.5 text-sm text-red-400">{error}</p>}

      {rows.length === 0 ? (
        <p className="border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">No pending gift requests right now.</p>
      ) : (
        <div className="overflow-x-auto border border-amber-500/40">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-amber-500/40 bg-bg-elevated text-[0.6rem] uppercase tracking-[0.14em] text-amber-300">
                <th className="px-3 py-2.5 font-semibold">Buyer (pays)</th>
                <th className="px-3 py-2.5 font-semibold">Contact</th>
                <th className="px-3 py-2.5 font-semibold">Recipient</th>
                <th className="px-3 py-2.5 font-semibold">Gift</th>
                <th className="px-3 py-2.5 font-semibold">Price</th>
                <th className="px-3 py-2.5 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-3 py-2.5">
                    <span className="font-semibold text-text">{r.buyer?.full_name || r.buyer?.ops_tag || "Player"}</span>
                    {r.buyer?.ops_tag && <span className="ml-2 font-mono text-[0.7rem] text-text-subtle">{r.buyer.ops_tag}</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-0.5 text-[0.7rem]">
                      {r.buyer?.phone ? (
                        <a href={`tel:${r.buyer.phone}`} className="font-semibold text-accent hover:underline">{r.buyer.phone}</a>
                      ) : (
                        <span className="text-text-subtle">No phone</span>
                      )}
                      {r.buyer?.email && (
                        <a href={`mailto:${r.buyer.email}`} className="text-text-subtle underline hover:text-accent">{r.buyer.email}</a>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-semibold text-text">{r.recipient?.full_name || r.recipient?.ops_tag || "Player"}</span>
                    {r.recipient?.ops_tag && <span className="ml-2 font-mono text-[0.7rem] text-text-subtle">{r.recipient.ops_tag}</span>}
                    {r.message && <p className="mt-1 max-w-[220px] whitespace-pre-wrap text-[0.7rem] italic text-text-subtle">&ldquo;{r.message}&rdquo;</p>}
                  </td>
                  <td className="px-3 py-2.5 text-text-muted">
                    <span className="font-mono text-accent">{fmtTokens(Number(r.tokens))}</span> token{Number(r.tokens) === 1 ? "" : "s"}
                  </td>
                  <td className="px-3 py-2.5 text-text-muted">{formatEur(Number(r.price_eur))}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <select
                        className="h-8 rounded-none border border-border-strong bg-bg px-1.5 text-xs text-text focus:border-accent focus:outline-none"
                        value={method[r.id] ?? "cash"}
                        onChange={(e) => setMethod((s) => ({ ...s, [r.id]: e.target.value }))}
                      >
                        <option value="cash">Cash</option>
                        <option value="revolut">Revolut</option>
                        <option value="none">No money entry</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => startFulfil(r)}
                        disabled={busy}
                        className="border border-accent bg-accent/10 px-2.5 py-1.5 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-accent hover:bg-accent/20 disabled:opacity-50"
                      >
                        Fulfil
                      </button>
                      <button
                        type="button"
                        onClick={() => decline(r)}
                        disabled={busy}
                        className="px-2 py-1.5 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-text-subtle hover:text-red-400 disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TotpGate
        open={!!gateFor}
        action={gateFor ? `grant ${fmtTokens(Number(gateFor.req.tokens))} token(s) to ${gateFor.req.recipient?.ops_tag || "the recipient"}` : "grant tokens"}
        onCancel={() => setGateFor(null)}
        onVerified={runFulfil}
      />
    </section>
  );
}
