"use client";

/**
 * components/portal/PaySettlement.tsx
 * --------------------------------------------------------------------
 * Post-game "settle up" calculator. Apply a game token (a whole token toward
 * this game - no fractions), add drinks, see the amount to pay by Revolut (or
 * cash), then confirm. Confirm spends the token immediately and records drinks +
 * a note for the Match Manager. After paying, "I've paid" signals the admin
 * (who confirms the money landed).
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { formatEur } from "@/lib/money";
import { cldImage } from "@/lib/cld";

type Drink = { id: string; name: string; price: number };
type SettleResult = { remaining: number; fullyCovered: boolean; shortNote: string; tokenApplied: number; drinksTotal: number };

const r2 = (n: number) => Math.round(n * 100) / 100;
const fmtTok = (n: number) => (Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(2))));

export function PaySettlement({
  matchId, matchCode, label, opsTag, gameFee, tokenBalance, tokenApplied,
  drinks, initialQuantities, revolutLink, alreadyPaid, tokenImageUrl, playerMarkedPaid,
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
  tokenImageUrl: string;
  playerMarkedPaid: boolean;
}) {
  const router = useRouter();
  const applicable = r2(Math.min(1, tokenApplied + tokenBalance));
  const [useToken, setUseToken] = useState<boolean>(tokenApplied > 0);
  const [qty, setQty] = useState<Record<string, number>>(() => ({ ...initialQuantities }));
  const [method, setMethod] = useState<"revolut" | "cash">("revolut");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SettleResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [marked, setMarked] = useState<boolean>(playerMarkedPaid);

  const drinksTotal = useMemo(
    () => r2(drinks.reduce((s, d) => s + (qty[d.id] || 0) * d.price, 0)),
    [drinks, qty],
  );
  const effToken = useToken ? applicable : tokenApplied;
  const tokenDelta = r2(effToken - tokenApplied); // newly applied now (projected spend)
  const balanceAfter = r2(tokenBalance - tokenDelta);
  const remaining = r2(gameFee * (1 - effToken) + drinksTotal);
  const shortNote = `${matchCode || "Game"} - ${opsTag || "player"}`;

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
    setUseToken(d.tokenApplied > 0);
    router.refresh();
  }

  async function iHavePaid() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("player_mark_settled", { p_match_id: matchId });
    setBusy(false);
    if (err) return setError(err.message);
    setMarked(true);
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

  const row = "flex items-center justify-between gap-3 py-1.5 text-sm";
  const greenBox = "flex items-center gap-2 border-l-2 border-emerald-500/70 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300";

  return (
    <div className="space-y-5">
      <header className="text-center">
        <h1 className="text-2xl font-extrabold uppercase tracking-[0.06em] text-text sm:text-3xl">Settle up</h1>
        <p className="mt-1 text-sm text-text-muted">{label}</p>
      </header>

      {/* Token */}
      {(tokenBalance > 0 || tokenApplied > 0) && (
        <section className="portal-card p-5">
          <div className="flex items-center gap-4">
            {tokenImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cldImage(tokenImageUrl, { w: 192 })} alt="" className="h-16 w-16 shrink-0 object-contain" />
            ) : null}
            <div className="min-w-0">
              <div className="text-xl font-extrabold leading-none text-text">
                {useToken && tokenDelta > 0 ? (
                  <>
                    <span className="text-text-subtle line-through">{fmtTok(tokenBalance)}</span>{" "}
                    <span className="text-accent">→ {fmtTok(balanceAfter)}</span>
                  </>
                ) : (
                  fmtTok(tokenBalance)
                )}{" "}
                <span className="text-base font-semibold text-text-muted">token{(useToken ? balanceAfter : tokenBalance) === 1 ? "" : "s"}</span>
              </div>
              <div className="mt-1 text-xs text-text-subtle">1 token = 1 free game.</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setUseToken((v) => !v)}
            disabled={tokenApplied > 0}
            className={`mt-4 flex w-full items-center justify-center gap-2 border px-4 py-3 text-sm font-bold uppercase tracking-[0.1em] transition-colors disabled:opacity-60 ${
              useToken ? "border-accent bg-accent text-bg" : "border-accent/60 text-accent hover:bg-accent/10"
            }`}
          >
            {useToken ? "Token applied" : "Use a token"} · −{formatEur(r2(gameFee * applicable))}
          </button>
          {tokenApplied > 0 && <p className="mt-2 text-[0.7rem] text-text-subtle">Already applied and spent.</p>}
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
        {effToken > 0 && <div className={row}><span className="text-text-muted">Token</span><span className="font-mono text-emerald-400">− {formatEur(r2(gameFee * effToken))}</span></div>}
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
          <section className="portal-card space-y-4 p-5">
            <div>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">{method === "cash" ? "Paying cash" : "Pay by Revolut"}</h2>
              {method === "revolut" ? (
                <>
                  <p className="text-sm text-text-muted">Send <span className="font-mono font-bold text-text">{formatEur(result.remaining)}</span> and paste this reference into the Revolut note:</p>
                  <div className="mt-2 flex items-center gap-2 border border-border bg-bg-overlay px-3 py-2">
                    <span className="min-w-0 flex-1 truncate font-mono text-sm text-text">{result.shortNote}</span>
                    <button type="button" onClick={copyNote} className="shrink-0 text-xs font-bold uppercase tracking-[0.1em] text-accent hover:text-white">{copied ? "Copied" : "Copy"}</button>
                  </div>
                  {revolutLink ? (
                    <a href={revolutLink} target="_blank" rel="noopener noreferrer"
                      className="mt-4 flex w-full items-center justify-center gap-2.5 border border-[#15181b] bg-[#15181b] px-5 py-3 text-sm font-bold uppercase tracking-[0.12em] text-white transition-transform active:scale-[0.98]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/images/revolut-logo.svg" alt="Revolut" className="h-4 w-auto" />
                      <span>Pay →</span>
                    </a>
                  ) : (
                    <p className="mt-4 text-xs text-amber-300">The Revolut link isn&apos;t set yet — please pay the LaserOps team directly.</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-text">Pay <span className="font-mono font-bold text-accent">{formatEur(result.remaining)}</span> in cash to the LaserOps team.</p>
              )}
            </div>

            {result.tokenApplied > 0 && (
              <div className={greenBox}>Token successfully used — {formatEur(r2(gameFee * result.tokenApplied))} off your game fee.</div>
            )}

            {marked ? (
              <div className={greenBox}>Thanks — we&apos;ll confirm your payment shortly.</div>
            ) : (
              <Button size="lg" className="w-full" onClick={iHavePaid} disabled={busy}>
                {busy ? "Working…" : method === "cash" ? "I'll pay cash" : "I've paid"}
              </Button>
            )}
          </section>
        )
      )}
    </div>
  );
}
