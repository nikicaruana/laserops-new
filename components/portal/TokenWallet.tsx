/**
 * components/portal/TokenWallet.tsx
 * --------------------------------------------------------------------
 * Read-only display of a player's LaserOps game-token balance, upcoming expiry,
 * recent activity, and their XP-boost stock (Double XP / 1.5x XP), shown on the
 * profile page. All values come from the server (ledgers the player can only
 * read); this component never writes. 1 token = 1 free game.
 */
import Link from "next/link";
import { formatEur } from "@/lib/money";
import { cldImage } from "@/lib/cld";

export type TokenLot = { amount_remaining: number | string; expires_at: string | null; source: string };
export type TokenTx = {
  delta: number | string;
  kind: string;
  created_at: string;
  note: string | null;
  eur_amount: number | string | null;
};

function fmtTokens(n: number): string {
  const r = Math.round(n * 10000) / 10000;
  return Number.isInteger(r) ? String(r) : String(parseFloat(r.toFixed(4)));
}

const KIND_LABEL: Record<string, string> = {
  grant: "Bundle added",
  spend: "Used on a game",
  refund: "Refunded to you",
  expiry: "Expired",
  adjustment: "Adjustment",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function BoostStat({ img, count, label }: { img: string; count: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cldImage(img, { w: 96, trim: true })} alt="" aria-hidden className="h-9 w-9 shrink-0 object-contain" />
      ) : null}
      <div>
        <p className="text-lg font-bold leading-none text-text">{count}</p>
        <p className="mt-0.5 text-[0.65rem] uppercase tracking-[0.1em] text-text-muted">{label}</p>
      </div>
    </div>
  );
}

export function TokenWallet({
  balance,
  lots,
  transactions,
  boosts,
  boostImages,
}: {
  balance: number;
  lots: TokenLot[];
  transactions: TokenTx[];
  boosts?: { double: number; oneFive: number };
  boostImages?: { double: string; oneFive: string };
}) {
  const active = lots
    .map((l) => ({ ...l, amount: Number(l.amount_remaining) }))
    .filter((l) => l.amount > 0 && l.expires_at)
    .sort((a, b) => new Date(a.expires_at as string).getTime() - new Date(b.expires_at as string).getTime());
  const nextExpiry = active[0];

  return (
    <section className="portal-card px-5 py-6 sm:px-7">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-accent">LaserOps Game Tokens</h2>
        <Link
          href="/player-portal/store"
          className="border border-accent px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-accent transition hover:bg-accent hover:text-black"
        >
          Buy tokens
        </Link>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-bold text-text">{fmtTokens(balance)}</span>
        <span className="text-sm text-text-muted">{balance === 1 ? "token" : "tokens"}</span>
      </div>
      <p className="mt-1 text-xs text-text-subtle">1 token = 1 free game. Use them when you pay for a game.</p>

      {nextExpiry && (
        <p className="mt-3 text-xs text-text-muted">
          {fmtTokens(nextExpiry.amount)} {nextExpiry.amount === 1 ? "token expires" : "tokens expire"} on{" "}
          <span className="text-text">{fmtDate(nextExpiry.expires_at as string)}</span>.
        </p>
      )}
      <p className="mt-2 text-[0.7rem] text-text-subtle">
        Tokens expire after their validity period; once expired they can&apos;t be used or refunded.{" "}
        <Link href="/terms" className="underline hover:text-accent">Token terms</Link>.
      </p>

      {boosts && (
        <div className="mt-6 border-t border-border pt-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-text-subtle">XP boosts</h3>
          <div className="flex flex-wrap gap-6">
            <BoostStat img={boostImages?.double ?? ""} count={boosts.double} label="Double XP" />
            <BoostStat img={boostImages?.oneFive ?? ""} count={boosts.oneFive} label="1.5x XP" />
          </div>
          <p className="mt-3 text-xs text-text-subtle">
            Earned by levelling up. Apply them when you sign in to a game to earn extra XP.
          </p>
        </div>
      )}

      {transactions.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-text-subtle">Recent activity</h3>
          <ul className="divide-y divide-border">
            {transactions.map((t, i) => {
              const d = Number(t.delta);
              return (
                <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-text">{t.note || KIND_LABEL[t.kind] || t.kind}</p>
                    <p className="text-xs text-text-subtle">{fmtDate(t.created_at)}</p>
                  </div>
                  <span className={`shrink-0 font-semibold ${d >= 0 ? "text-emerald-400" : "text-text-muted"}`}>
                    {d >= 0 ? "+" : ""}
                    {fmtTokens(d)}
                    {t.eur_amount != null ? <span className="ml-1 text-xs text-text-subtle">({formatEur(t.eur_amount)})</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
