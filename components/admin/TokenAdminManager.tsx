"use client";

/**
 * components/admin/TokenAdminManager.tsx
 * --------------------------------------------------------------------
 * Admin UI for the game-token system. Three cards: default validity, store
 * bundles (add / edit / remove), and a manual grant/refund tool. EVERY change on
 * this page - validity, bundle edits, and token grants/refunds - requires a 2FA
 * step-up (TotpGate) before it runs, so no token config or balance can be changed
 * from an unattended admin session. Grants/refunds additionally go through the
 * admin-gated RPCs (which re-check is_admin server-side).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TotpGate } from "@/components/admin/TotpGate";
import { createClient } from "@/lib/supabase/client";
import { formatEur } from "@/lib/money";
import { AccountPicker } from "@/components/admin/AccountPicker";

type Bundle = {
  id: string;
  name: string;
  tokens: number;
  price_eur: number;
  validity_months: number | null;
  is_active: boolean;
  sort_order: number | null;
};

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg-elevated px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 border border-border bg-bg-elevated p-5 sm:p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-accent">{title}</h2>
      {children}
    </section>
  );
}

export function TokenAdminManager({
  defaultValidityMonths,
  initialBundles,
}: {
  defaultValidityMonths: number;
  initialBundles: Bundle[];
}) {
  const router = useRouter();
  const supabase = createClient();

  // Every mutation on this page runs only after a TOTP step-up. `gate` holds the
  // pending action (what to say in the modal + the work to run once verified).
  const [gate, setGate] = useState<{ action: string; run: () => void | Promise<void> } | null>(null);
  function requireTotp(action: string, run: () => void | Promise<void>) {
    setGate({ action, run });
  }
  async function runGate() {
    if (!gate) return;
    const fn = gate.run;
    setGate(null);
    await fn();
  }

  // ---- config ----
  const [validity, setValidity] = useState(String(defaultValidityMonths));
  const [savingCfg, setSavingCfg] = useState(false);
  const [cfgMsg, setCfgMsg] = useState<string | null>(null);

  function saveConfig() {
    const n = Math.max(1, Math.round(Number(validity) || 0));
    requireTotp("the token validity change", async () => {
      setSavingCfg(true);
      setCfgMsg(null);
      const { error } = await supabase
        .from("token_config")
        .update({ default_validity_months: n, updated_at: new Date().toISOString() })
        .eq("id", 1);
      setSavingCfg(false);
      setCfgMsg(error ? error.message : "Saved.");
      if (!error) router.refresh();
    });
  }

  // ---- bundles ----
  const [bundles, setBundles] = useState<Bundle[]>(initialBundles);
  const [bundleMsg, setBundleMsg] = useState<string | null>(null);

  function patch(id: string, p: Partial<Bundle>) {
    setBundles((bs) => bs.map((b) => (b.id === id ? { ...b, ...p } : b)));
  }

  function saveBundle(b: Bundle) {
    requireTotp(`the change to “${b.name.trim() || "this bundle"}”`, async () => {
      setBundleMsg(null);
      const { error } = await supabase
        .from("token_bundles")
        .update({
          name: b.name.trim(),
          tokens: b.tokens,
          price_eur: b.price_eur,
          validity_months: b.validity_months,
          is_active: b.is_active,
          sort_order: b.sort_order,
        })
        .eq("id", b.id);
      setBundleMsg(error ? error.message : `Saved “${b.name}”.`);
      if (!error) router.refresh();
    });
  }

  function addBundle() {
    requireTotp("a new bundle", async () => {
      setBundleMsg(null);
      const { error } = await supabase.from("token_bundles").insert({
        name: "New bundle",
        tokens: 5,
        price_eur: 150,
        validity_months: null,
        is_active: false,
        sort_order: (bundles.reduce((m, b) => Math.max(m, b.sort_order ?? 0), 0) || 0) + 1,
      });
      if (error) setBundleMsg(error.message);
      else router.refresh();
    });
  }

  function removeBundle(id: string) {
    requireTotp("removing this bundle", async () => {
      setBundleMsg(null);
      const { error } = await supabase.from("token_bundles").delete().eq("id", id);
      if (error) setBundleMsg(error.message);
      else {
        setBundles((bs) => bs.filter((b) => b.id !== id));
        router.refresh();
      }
    });
  }

  // ---- manual grant / refund ----
  const [opsTag, setOpsTag] = useState("");
  const [amount, setAmount] = useState("");
  const [grantValidity, setGrantValidity] = useState("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"grant" | "refund">("grant");
  const [granting, setGranting] = useState(false);
  const [grantMsg, setGrantMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function startGrant() {
    setGranting(true);
    setGrantMsg(null);
    const amt = Number(amount);
    if (!opsTag.trim() || !Number.isFinite(amt) || amt <= 0) {
      setGranting(false);
      setGrantMsg({ ok: false, text: "Enter an ops tag and a positive amount." });
      return;
    }
    // Resolve the player (admins can read accounts) before the 2FA step.
    const { data: acct, error: lookupErr } = await supabase
      .from("accounts")
      .select("id, ops_tag")
      .ilike("ops_tag", opsTag.trim())
      .maybeSingle();
    setGranting(false);
    if (lookupErr || !acct) {
      setGrantMsg({ ok: false, text: `No player found with ops tag “${opsTag.trim()}”.` });
      return;
    }
    const vm = grantValidity.trim() ? Math.max(1, Math.round(Number(grantValidity))) : null;
    const p = { acctId: acct.id, opsTag: acct.ops_tag ?? opsTag.trim(), amt, vm };
    requireTotp(mode === "grant" ? "this token grant" : "this token refund", () => confirmGrant(p));
  }

  async function confirmGrant(p: { acctId: string; opsTag: string; amt: number; vm: number | null }) {
    setGranting(true);
    setGrantMsg(null);
    const { error } =
      mode === "grant"
        ? await supabase.rpc("admin_grant_tokens", {
            p_acct: p.acctId,
            p_amount: p.amt,
            p_validity_months: p.vm,
            p_note: note.trim() || null,
          })
        : await supabase.rpc("admin_refund_tokens", {
            p_acct: p.acctId,
            p_amount: p.amt,
            p_match_id: null,
            p_note: note.trim() || null,
          });
    setGranting(false);
    if (error) {
      setGrantMsg({ ok: false, text: error.message });
      return;
    }
    setGrantMsg({ ok: true, text: `${mode === "grant" ? "Granted" : "Refunded"} ${p.amt} token(s) to ${p.opsTag}.` });
    setAmount("");
    setNote("");
    router.refresh();
  }

  return (
    <div>
      {/* Config */}
      <Card title="Token settings">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-48">
            <label className={labelCls} htmlFor="validity">
              Default validity (months)
            </label>
            <input
              id="validity"
              type="number"
              min={1}
              value={validity}
              onChange={(e) => setValidity(e.target.value)}
              className={input}
            />
          </div>
          <Button variant="secondary" size="md" onClick={saveConfig} disabled={savingCfg}>
            {savingCfg ? "Saving…" : "Save"}
          </Button>
          {cfgMsg && <span className="text-xs text-text-muted">{cfgMsg}</span>}
        </div>
        <p className="mt-3 text-xs text-text-subtle">
          Used when a bundle doesn&apos;t set its own validity. A bundle&apos;s tokens expire this many months after
          purchase.
        </p>
      </Card>

      {/* Bundles */}
      <Card title="Store bundles">
        <div className="space-y-4">
          {bundles.length === 0 && <p className="text-sm text-text-muted">No bundles yet.</p>}
          {bundles.map((b) => {
            const perGame = b.tokens > 0 ? b.price_eur / b.tokens : 0;
            return (
              <div key={b.id} className="border border-border p-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="lg:col-span-2">
                    <label className={labelCls}>Name</label>
                    <input className={input} value={b.name} onChange={(e) => patch(b.id, { name: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Tokens</label>
                    <input
                      className={input}
                      type="number"
                      min={0}
                      step="0.25"
                      value={b.tokens}
                      onChange={(e) => patch(b.id, { tokens: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Price (€)</label>
                    <input
                      className={input}
                      type="number"
                      min={0}
                      step="0.01"
                      value={b.price_eur}
                      onChange={(e) => patch(b.id, { price_eur: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Validity (months)</label>
                    <input
                      className={input}
                      type="number"
                      min={1}
                      placeholder="default"
                      value={b.validity_months ?? ""}
                      onChange={(e) => patch(b.id, { validity_months: e.target.value ? Number(e.target.value) : null })}
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">
                      <input
                        type="checkbox"
                        checked={b.is_active}
                        onChange={(e) => patch(b.id, { is_active: e.target.checked })}
                        className="h-4 w-4 accent-[var(--color-accent)]"
                      />
                      Active (visible in store)
                    </label>
                    <span className="text-xs text-text-subtle">
                      {formatEur(perGame)} per game
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => saveBundle(b)}>
                      Save
                    </Button>
                    <button
                      type="button"
                      onClick={() => removeBundle(b.id)}
                      className="px-3 text-xs font-semibold uppercase tracking-[0.1em] text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={addBundle}>
            + Add bundle
          </Button>
          {bundleMsg && <span className="text-xs text-text-muted">{bundleMsg}</span>}
        </div>
      </Card>

      {/* Manual grant / refund */}
      <Card title="Grant or refund tokens">
        <div className="mb-4 inline-flex border border-border-strong">
          {(["grant", "refund"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition ${
                mode === m ? "bg-accent text-black" : "text-text-muted hover:text-accent"
              }`}
            >
              {m === "grant" ? "Grant" : "Refund"}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={labelCls}>Player ops tag</label>
            {opsTag ? (
              <div className="flex h-11 items-center gap-2 border border-border-strong bg-bg px-3">
                <span className="text-sm font-semibold text-accent">{opsTag}</span>
                <button type="button" onClick={() => setOpsTag("")} className="ml-auto text-xs text-text-subtle hover:text-accent">Change</button>
              </div>
            ) : (
              <AccountPicker onPick={(a) => setOpsTag(a.ops_tag ?? "")} autoFocus={false} />
            )}
          </div>
          <div>
            <label className={labelCls}>Tokens</label>
            <input
              className={input}
              type="number"
              min={0}
              step="0.1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 5 or 0.4"
            />
          </div>
          {mode === "grant" && (
            <div>
              <label className={labelCls}>Validity (months)</label>
              <input
                className={input}
                type="number"
                min={1}
                value={grantValidity}
                onChange={(e) => setGrantValidity(e.target.value)}
                placeholder="default"
              />
            </div>
          )}
          <div className={mode === "grant" ? "" : "sm:col-span-1"}>
            <label className={labelCls}>Note</label>
            <input
              className={input}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={mode === "grant" ? "e.g. milestone reward" : "e.g. weather call-off"}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <Button variant="primary" size="md" onClick={startGrant} disabled={granting}>
            {granting ? "Working…" : mode === "grant" ? "Grant tokens" : "Refund tokens"}
          </Button>
          {grantMsg && <span className={`text-xs ${grantMsg.ok ? "text-emerald-400" : "text-red-400"}`}>{grantMsg.text}</span>}
        </div>
        <p className="mt-3 text-xs text-text-subtle">
          Every change on this page - validity, bundles, and token grants/refunds - requires two-factor authentication.
          Refunds credit fractional tokens (e.g. 0.4) as a new lot the player can spend toward their next game.
        </p>
      </Card>

      <TotpGate
        open={gate !== null}
        action={gate?.action ?? "this change"}
        onCancel={() => setGate(null)}
        onVerified={runGate}
      />
    </div>
  );
}
