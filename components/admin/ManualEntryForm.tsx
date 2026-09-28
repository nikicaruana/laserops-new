"use client";

/**
 * components/admin/ManualEntryForm.tsx
 * --------------------------------------------------------------------
 * Records a PAYMENT that didn't come through online checkout - an in-person game
 * paid in cash, a drink sale - so the financial ledger stays the single source of
 * truth. Refunds aren't entered here: online refunds log automatically, and
 * in-person "refunds" are handled by taking a reduced payment / not charging.
 * Calls admin_add_financial_entry (admin-gated definer). Collapsed by default.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

// [color-scheme:dark] makes native date/time pickers (and their icons) render
// light-on-dark instead of the invisible black-on-dark default.
const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg-elevated px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none [color-scheme:dark]";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted";

type GameOption = { id: string; label: string };

export function ManualEntryForm({ games = [] }: { games?: GameOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("game");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [occurredAt, setOccurredAt] = useState("");
  const [opsTag, setOpsTag] = useState("");
  const [matchId, setMatchId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    setMsg(null);
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) return setMsg({ ok: false, text: "Enter a valid amount." });
    setBusy(true);
    const supabase = createClient();

    // Optional player link by ops tag.
    let accountId: string | null = null;
    if (opsTag.trim()) {
      const { data: acct } = await supabase.from("accounts").select("id").ilike("ops_tag", opsTag.trim()).maybeSingle();
      if (!acct) {
        setBusy(false);
        return setMsg({ ok: false, text: `No player found with ops tag “${opsTag.trim()}”.` });
      }
      accountId = acct.id;
    }

    const { error } = await supabase.rpc("admin_add_financial_entry", {
      p_occurred_at: occurredAt ? new Date(occurredAt).toISOString() : null,
      p_direction: "payment",
      p_category: category,
      p_amount: amt,
      p_method: method.trim() || null,
      p_account_id: accountId,
      p_match_id: matchId || null,
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: "Entry recorded." });
    setAmount("");
    setNote("");
    setOpsTag("");
    setMatchId("");
    router.refresh();
  }

  return (
    <div className="mb-6 border border-border bg-bg-elevated print:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted transition hover:text-accent"
      >
        Record a manual payment (cash game, drinks)
        <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="border-t border-border px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={labelCls}>Category</label>
              <select className={input} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="game">Game</option>
                <option value="drinks">Drinks</option>
                <option value="tokens">Tokens</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Amount (€)</label>
              <input className={input} type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Method</label>
              <select className={input} value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank">Bank transfer</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Date &amp; time</label>
              <input className={input} type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Player ops tag (optional)</label>
              <input className={input} value={opsTag} onChange={(e) => setOpsTag(e.target.value)} placeholder="e.g. Kini" />
            </div>
            <div>
              <label className={labelCls}>Game (optional)</label>
              <select className={input} value={matchId} onChange={(e) => setMatchId(e.target.value)}>
                <option value="">Not tied to a game</option>
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-3">
              <label className={labelCls}>Note</label>
              <input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Private booking - 8 players, paid cash" />
            </div>
          </div>
          <p className="mt-3 text-xs text-text-subtle">
            For payments taken outside online checkout (cash, card machine, bank transfer). Refunds aren&apos;t entered
            here - online refunds log automatically, and for in-person cases you&apos;d take a reduced payment or not
            charge.
          </p>
          <div className="mt-4 flex items-center gap-4">
            <Button variant="primary" size="md" onClick={submit} disabled={busy}>
              {busy ? "Saving…" : "Record entry"}
            </Button>
            {msg && <span className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
