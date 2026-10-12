/**
 * app/admin/payments/page.tsx
 * --------------------------------------------------------------------
 * "Payments due" - a cross-game view of who still owes. Lists every per-player,
 * already-played roster line that is linked to an account and not marked paid,
 * grouped by game, with the amount owed (game fee less any token, plus drinks).
 * Settle each one from its Match Manager ("Players & payments"). Admin-only via
 * the admin_outstanding_settlements RPC (RLS admin session).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatEur } from "@/lib/money";

export const metadata: Metadata = { title: "Payments due" };

type Row = {
  match_id: string;
  match_code: string | null;
  title: string | null;
  scheduled_at: string | null;
  account_id: string;
  ops_tag: string | null;
  full_name: string | null;
  settled_declared_at: string | null;
  player_marked_paid_at: string | null;
  settlement_token_intent: number | null;
  drinks_total_eur: number | null;
  settlement_method: string | null;
  game_fee: number | null;
  owed: number | null;
};

const fmtTok = (n: number) => (Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(2))));

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-bg-elevated px-4 py-3">
      <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-text-subtle">{label}</p>
      <p className="mt-1 text-lg font-bold text-text">{value}</p>
    </div>
  );
}

export default async function PaymentsDuePage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_outstanding_settlements");
  const rows = (data ?? []) as Row[];

  // Group by game, preserving the RPC's order (most recent game first).
  const games: { id: string; code: string; date: string; rows: Row[]; total: number }[] = [];
  const index = new Map<string, number>();
  for (const r of rows) {
    let i = index.get(r.match_id);
    if (i == null) {
      i = games.length;
      index.set(r.match_id, i);
      games.push({
        id: r.match_id,
        code: r.match_code || r.title || r.match_id.slice(0, 8),
        date: fmtDate(r.scheduled_at),
        rows: [],
        total: 0,
      });
    }
    games[i].rows.push(r);
    games[i].total += Number(r.owed ?? 0);
  }

  const totalOwed = rows.reduce((s, r) => s + Number(r.owed ?? 0), 0);

  return (
    <div>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Payments due</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          Players who still owe for a game they played. Settle each from its Match Manager. A token already applied on the
          pay page is deducted here; the figure is what&apos;s left to pay (plus any drinks).
        </p>
      </header>

      {error ? (
        <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error.message}</p>
      ) : rows.length === 0 ? (
        <p className="border border-dashed border-border px-4 py-12 text-center text-sm text-text-muted">
          Everyone&apos;s settled up. Nothing outstanding.
        </p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-3">
            <Stat label="Players owing" value={String(rows.length)} />
            <Stat label="Games" value={String(games.length)} />
            <Stat label="Total outstanding" value={formatEur(totalOwed)} />
          </div>

          <div className="space-y-6">
            {games.map((g) => (
              <div key={g.id} className="border border-border">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-bg-elevated px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-mono text-sm font-bold text-accent">{g.code}</span>
                    {g.date && <span className="text-xs text-text-subtle">{g.date}</span>}
                    <span className="text-xs text-text-muted">· {g.rows.length} owing · {formatEur(g.total)}</span>
                  </div>
                  <Link
                    href={`/admin/matches/${g.id}`}
                    className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-accent hover:text-accent-soft"
                  >
                    Settle in Match Manager →
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
                        <th className="px-4 py-2.5 font-semibold">Player</th>
                        <th className="px-4 py-2.5 font-semibold">Declared</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Owed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.map((r) => {
                        const tok = Number(r.settlement_token_intent ?? 0);
                        const drinks = Number(r.drinks_total_eur ?? 0);
                        return (
                          <tr key={r.account_id} className="border-b border-border/60 last:border-0 align-middle">
                            <td className="px-4 py-2.5">
                              <span className="font-semibold text-text">{r.full_name || r.ops_tag || "Player"}</span>
                              {r.ops_tag && <span className="ml-2 font-mono text-[0.7rem] text-text-subtle">{r.ops_tag}</span>}
                            </td>
                            <td className="px-4 py-2.5 text-xs">
                              {r.settled_declared_at ? (
                                <span className={r.player_marked_paid_at ? "text-emerald-300" : "text-amber-300"}>
                                  {tok > 0 ? `Token ${fmtTok(tok)} · ` : ""}
                                  {drinks > 0 ? `Drinks ${formatEur(drinks)} · ` : ""}
                                  {r.player_marked_paid_at ? "player says paid" : "awaiting"}
                                  {r.settlement_method ? ` (${r.settlement_method})` : ""}
                                </span>
                              ) : (
                                <span className="text-text-subtle">Not declared</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-text">{formatEur(Number(r.owed ?? 0))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
