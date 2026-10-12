"use client";

/**
 * components/admin/TokenPackRequests.tsx
 * --------------------------------------------------------------------
 * Pending token-pack requests (the pay-after-game store has no online payment -
 * players request a pack and an admin settles it by hand). Fulfil grants the
 * tokens and, when a method is picked, records the money on the financial
 * reports; Decline closes the request with no grant. Both go through the
 * admin-gated SECURITY DEFINER RPCs.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatEur } from "@/lib/money";

type Req = {
  id: string;
  bundle_name: string;
  tokens: number;
  price_eur: number;
  created_at: string;
  account: { ops_tag: string | null; full_name: string | null; email: string | null } | null;
};

const fmtTokens = (n: number) => (Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(2))));

export function TokenPackRequests({ initial }: { initial: Req[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Req[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<Record<string, string>>({});

  async function fulfil(r: Req) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const m = method[r.id] ?? "cash";
    const { error: err } = await supabase.rpc("admin_fulfil_token_pack_request", {
      p_request_id: r.id,
      p_method: m === "none" ? null : m,
    });
    setBusy(false);
    if (err) return setError(err.message);
    setRows((prev) => prev.filter((x) => x.id !== r.id));
    router.refresh();
  }

  async function decline(r: Req) {
    if (!window.confirm(`Decline ${r.account?.ops_tag || "this player"}'s request for the ${r.bundle_name} pack?`)) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("admin_decline_token_pack_request", { p_request_id: r.id, p_note: null });
    setBusy(false);
    if (err) return setError(err.message);
    setRows((prev) => prev.filter((x) => x.id !== r.id));
    router.refresh();
  }

  if (rows.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-[0.12em] text-accent">
        Pending pack requests <span className="text-text-muted">({rows.length})</span>
      </h2>
      <p className="mb-3 text-xs text-text-muted">
        A player asked to buy a pack. Collect the payment (cash or Revolut), pick the method so it lands on the financial
        reports, then Fulfil to grant the tokens. Pick &ldquo;No money entry&rdquo; if you&apos;ll record it yourself.
      </p>

      {error && <p className="mb-3 border border-red-800 bg-red-950/40 px-4 py-2.5 text-sm text-red-400">{error}</p>}

      <div className="overflow-x-auto border border-amber-500/40">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-amber-500/40 bg-bg-elevated text-[0.6rem] uppercase tracking-[0.14em] text-amber-300">
              <th className="px-3 py-2.5 font-semibold">Player</th>
              <th className="px-3 py-2.5 font-semibold">Pack</th>
              <th className="px-3 py-2.5 font-semibold">Tokens</th>
              <th className="px-3 py-2.5 font-semibold">Price</th>
              <th className="px-3 py-2.5 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 align-middle">
                <td className="px-3 py-2.5">
                  <div className="flex flex-col gap-0.5">
                    <span>
                      <span className="font-semibold text-text">{r.account?.full_name || r.account?.ops_tag || "Player"}</span>
                      {r.account?.ops_tag && <span className="ml-2 font-mono text-[0.7rem] text-text-subtle">{r.account.ops_tag}</span>}
                    </span>
                    {r.account?.email && (
                      <a href={`mailto:${r.account.email}`} className="text-[0.7rem] text-text-subtle underline hover:text-accent">{r.account.email}</a>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-text-muted">{r.bundle_name}</td>
                <td className="px-3 py-2.5 font-mono text-accent">{fmtTokens(Number(r.tokens))}</td>
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
                      onClick={() => fulfil(r)}
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
    </section>
  );
}
