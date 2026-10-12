"use client";

/**
 * components/portal/PaySettlement.tsx
 * --------------------------------------------------------------------
 * Post-game "settle up" calculator. The player applies a game token (full or a
 * fraction), adds drinks (with quantity), and sees the amount to pay by Revolut
 * (or chooses cash). On confirm it calls settle_match_bill, which spends the
 * token immediately and records drinks + a note for the Match Manager; the
 * Revolut/cash remainder is then confirmed by an admin.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { formatEur } from "@/lib/money";

type Drink = { id: string; name: string; price: number };
type SettleResult = { remaining: number; fullyCovered: boolean; shortNote: string; tokenApplied: number; drinksTotal: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

export function PaySettlement({
  matchId, matchCode, label, opsTag, gameFee, tokenBalance, tokenApplied,
  drinks, initialQuantities, revolutLink, alreadyPaid,
}: {
  matchId: string;
  matchCode: string;
  label: string;
  opsTag: string;
  gameFee: number;
  tokenBalance: number;
  tokenApplied: number;
  drinks: Drink[];
  initialQuantities: Record<string, number>;
  revolutLink: string;
  alreadyPaid: boolean;
}) {
  const router = useRouter();
  const maxToken = r2(Math.min(tokenBalance, 1));
  const [tokenUse, setTokenUse] = useState<number>(r2(Math.max(tokenApplied, 0)));
  const [qty, setQty] = useState<Record<string, number>>(() => ({ ...initialQuantities }));
  const [method, setMethod] = useState<"revolut" | "cash">("revolut");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SettleResult | null>(null);
  const [copied, setCopied] = useState(false);

  const drinksTotal = useMemo(
    () => r2(drinks.reduce((s, d) => s + (qty[d.id] || 0) * d.price, 0)),
    [drinks, qty],
  );
  const effToken = Math.max(tokenApplied, tokenUse);
  const remaining = r2(gameFee * (1 - effToken) + drinksTotal);
  const shortNote = `${matchCode || "Game"} - ${opsTag || "player"}`;

  function stepToken(delta: number) {
    setTokenUse((t) => r2(Math.min(maxToken, Math.max(tokenApplied, t + delta))));
  }
  function stepQty(id: string, delta: number) {
    setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] || 0) + delta) }));
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const p_drinks = drinks.filter((d) => (qty[d.id] || 0) > 0).map((d) => ({ drink_id: d.id, qty: qty[d.id] }));
    const { data, error: err } = await supabase.rpc("settle_match_bill", {
      p_match_id: matchId, p_token_amount: effToken, p_method: method, p_drinks, p_idempotency_key: crypto.randomUUID(),
    });
    setBusy(false);
    if (err) return setError(err.message);
    const d = data as SettleResult;
    setResult(d);
    setTokenUse(r2(d.tokenApplied));
    router.refresh();
  }

  async function copyNote() {
    try {
      await navigator.clipboard.writeText(result?.shortNote || shortNote);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  if (alreadyPaid && !result) {
    return (
      <div className="portal-card p-6 text-center">
        <h1 className="text-xl font-bold uppercase tracking-[0.08em] text-text">You&apos;re all settled</h1>
        <p className="mt-2 text-sm text-text-muted">Thanks — nothing left to pay for {label}.</p>
      </div>
    );
  }

  const fmtTok = (n: number) => (Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(2))));
  const row = "flex items-center justify-between gap-3 py-1.5 text-sm";

  return (
    <div className="space-y-5">
      <header className="text-center">
        <h1 className="text-2xl font-extrabold uppercase tracking-[0.06em] text-text sm:text-3xl">Settle up</h1>
        <p className="mt-1 text-sm text-text-muted">{label}</p>
      </header>

      {/* Token */}
      {maxToken > 0 && (
        <section className="portal-card p-5">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Use a game token</h2>
            <span className="text-xs text-text-subtle">You have {fmtTok(tokenBalance)} token{tokenBalance === 1 ? "" : "s"}</span>
          </div>
          <p className="mb-3 text-xs text-text-subtle">1 token = 1 free game. Apply a full token or a part of one toward this game&apos;s fee.</p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => stepToken(-0.25)} disabled={effToken <= tokenApplied}
              className="h-10 w-10 border border-border-strong text-lg text-text hover:border-accent disabled:opacity-40">−</button>
            <div className="min-w-[5rem] text-center">
              <div className="font-mono text-lg font-bold text-accent">{fmtTok(effToken)}</div>
              <div className="text-[0.6rem] uppercase tracking-[0.12em] text-text-subtle">token applied</div>
            </div>
            <button type="button" onClick={() => stepToken(0.25)} disabled={effToken >= maxToken}
              className="h-10 w-10 border border-border-strong text-lg text-text hover:border-accent disabled:opacity-40">+</button>
            <button type="button" onClick={() => setTokenUse(maxToken)} disabled={effToken >= maxToken}
              className="ml-auto text-xs font-semibold uppercase tracking-[0.1em] text-text-muted hover:text-accent disabled:opacity-40">Use max</button>
          </div>
          {tokenApplied > 0 && <p className="mt-2 text-[0.7rem] text-text-subtle">{fmtTok(tokenApplied)} already applied and spent (can&apos;t be reduced here).</p>}
        </section>
      )}

      {/* Drinks */}
      {drinks.length > 0 && (
        <section className="portal-card p-5">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-accent">Drinks</h2>
          <div className="divide-y divide-border">
            {drinks.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-text">{d.name}</span>
                  <span className="text-xs text-text-subtle">{formatEur(d.price)} each</span>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => stepQty(d.id, -1)} disabled={(qty[d.id] || 0) <= 0}
                    className="h-9 w-9 border border-border-strong text-text hover:border-accent disabled:opacity-40">−</button>
                  <span className="w-7 text-center font-mono text-sm text-text">{qty[d.id] || 0}</span>
                  <button type="button" onClick={() => stepQty(d.id, 1)}
                    className="h-9 w-9 border border-border-strong text-text hover:border-accent">+</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Summary */}
      <section className="portal-card p-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">Your total</h2>
        <div className={row}><span className="text-text-muted">Game fee</span><span className="font-mono text-text">{formatEur(gameFee)}</span></div>
        {effToken > 0 && <div className={row}><span className="text-text-muted">Token ({fmtTok(effToken)})</span><span className="font-mono text-emerald-400">− {formatEur(r2(gameFee * effToken))}</span></div>}
        {drinksTotal > 0 && <div className={row}><span className="text-text-muted">Drinks</span><span className="font-mono text-text">+ {formatEur(drinksTotal)}</span></div>}
        <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm font-bold uppercase tracking-[0.1em] text-text">To pay</span>
          <span className="font-mono text-2xl font-extrabold text-accent">{formatEur(remaining)}</span>
        </div>
      </section>

      {/* Method + confirm */}
      {remaining > 0 ? (
        <section className="portal-card p-5">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-accent">How are you paying?</h2>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMethod("revolut")}
              className={`border px-4 py-3 text-sm font-bold uppercase tracking-[0.1em] transition-colors ${method === "revolut" ? "border-accent bg-accent/10 text-accent" : "border-border-strong text-text-muted hover:border-accent"}`}>Revolut</button>
            <button type="button" onClick={() => setMethod("cash")}
              className={`border px-4 py-3 text-sm font-bold uppercase tracking-[0.1em] transition-colors ${method === "cash" ? "border-accent bg-accent/10 text-accent" : "border-border-strong text-text-muted hover:border-accent"}`}>Cash</button>
          </div>
          <Button size="lg" className="w-full" onClick={confirm} disabled={busy}>
            {busy ? "Working…" : result ? "Update" : "Confirm"}
          </Button>
          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        </section>
      ) : (
        <section className="portal-card p-5 text-center">
          <p className="text-sm text-text">Fully covered by your token — nothing to pay.</p>
          <Button size="lg" className="mt-3 w-full" onClick={confirm} disabled={busy}>{busy ? "Working…" : "Confirm (use token)"}</Button>
          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        </section>
      )}

      {/* Result */}
      {result && (
        result.fullyCovered ? (
          <section className="portal-card border-l-2 border-emerald-500/70 p-5 text-center">
            <p className="text-sm font-semibold text-emerald-300">Covered by your token — nothing to pay. See you next time!</p>
          </section>
        ) : (
          <section className="portal-card p-5">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">{result && result.remaining === remaining && method === "revolut" ? "Pay by Revolut" : method === "cash" ? "Paying cash" : "Pay by Revolut"}</h2>
            {method === "revolut" ? (
              <>
                <p className="text-sm text-text-muted">Send <span className="font-mono font-bold text-text">{formatEur(result.remaining)}</span> and paste this reference into the Revolut note:</p>
                <div className="mt-2 flex items-center gap-2 border border-border bg-bg-overlay px-3 py-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-sm text-text">{result.shortNote}</span>
                  <button type="button" onClick={copyNote} className="shrink-0 text-xs font-bold uppercase tracking-[0.1em] text-accent hover:text-white">{copied ? "Copied" : "Copy"}</button>
                </div>
                {revolutLink ? (
                  <a href={revolutLink} target="_blank" rel="noopener noreferrer"
                    className="mt-4 flex w-full items-center justify-center border border-accent bg-accent px-5 py-3 text-sm font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98]">
                    Open Revolut →
                  </a>
                ) : (
                  <p className="mt-4 text-xs text-amber-300">The Revolut link isn&apos;t set yet — please pay the LaserOps team directly.</p>
                )}
                <p className="mt-3 text-[0.7rem] text-text-subtle">We&apos;ll confirm your payment once it lands. Any token you used has already been applied.</p>
              </>
            ) : (
              <>
                <p className="text-sm text-text">Pay <span className="font-mono font-bold text-accent">{formatEur(result.remaining)}</span> in cash to the LaserOps team.</p>
                <p className="mt-3 text-[0.7rem] text-text-subtle">We&apos;ll mark it paid when you settle up. Any token you used has already been applied.</p>
              </>
            )}
          </section>
        )
      )}
    </div>
  );
}
