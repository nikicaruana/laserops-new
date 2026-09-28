"use client";

/**
 * components/portal/GiftTokensModal.tsx
 * --------------------------------------------------------------------
 * Gift game tokens to someone: pick a single token or a bundle, choose the
 * recipient by ops tag (an existing player) or by email (they claim it after
 * signing up), add an optional message, and pay. Posts to /api/store/gift, which
 * prices it server-side; delivery + emails happen after payment is confirmed.
 */
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatEur } from "@/lib/money";

type Bundle = { id: string; name: string; tokens: number; price_eur: number };

const input =
  "h-11 w-full rounded-none border border-border bg-bg-overlay px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted";

export function GiftTokensModal({
  bundles,
  singleTokenPrice,
  onClose,
}: {
  bundles: Bundle[];
  singleTokenPrice: number;
  onClose: () => void;
}) {
  // "single" or a bundle id.
  const [choice, setChoice] = useState<string>("single");
  const [recipientType, setRecipientType] = useState<"ops" | "email">("ops");
  const [opsTag, setOpsTag] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = [
    { id: "single", label: "1 game token", tokens: 1, price: singleTokenPrice },
    ...bundles.map((b) => ({ id: b.id, label: b.name, tokens: b.tokens, price: b.price_eur })),
  ];

  async function submit() {
    setError(null);
    if (recipientType === "ops" && !opsTag.trim()) return setError("Enter the player's ops tag.");
    if (recipientType === "email" && !email.trim()) return setError("Enter the recipient's email.");
    setLoading(true);
    try {
      const res = await fetch("/api/store/gift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          single: choice === "single",
          bundleId: choice === "single" ? undefined : choice,
          opsTag: recipientType === "ops" ? opsTag.trim() : undefined,
          email: recipientType === "email" ? email.trim() : undefined,
          message: message.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
      if (!data.ok || !data.url) {
        setError(data.error || "Couldn't start checkout.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <Modal title="Gift game tokens" onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-5">
        <div>
          <span className={labelCls}>What to gift</span>
          <div className="space-y-2">
            {options.map((o) => (
              <label
                key={o.id}
                className={`flex cursor-pointer items-center justify-between border px-3 py-2.5 text-sm transition ${
                  choice === o.id ? "border-accent bg-accent/10" : "border-border hover:border-border-strong"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="gift-choice"
                    checked={choice === o.id}
                    onChange={() => setChoice(o.id)}
                    className="h-4 w-4 accent-[var(--color-accent)]"
                  />
                  <span className="font-semibold text-text">{o.label}</span>
                  <span className="text-xs text-text-subtle">
                    {o.tokens} token{o.tokens === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="font-semibold text-accent">{formatEur(o.price)}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <span className={labelCls}>Who's it for</span>
          <div className="mb-3 inline-flex border border-border-strong">
            {(["ops", "email"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setRecipientType(t)}
                className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition ${
                  recipientType === t ? "bg-accent text-black" : "text-text-muted hover:text-accent"
                }`}
              >
                {t === "ops" ? "By ops tag" : "By email"}
              </button>
            ))}
          </div>
          {recipientType === "ops" ? (
            <input className={input} value={opsTag} onChange={(e) => setOpsTag(e.target.value)} placeholder="Their ops tag" />
          ) : (
            <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="their@email.com" />
          )}
          <p className="mt-1.5 text-xs text-text-subtle">
            {recipientType === "ops"
              ? "Tokens land on their account right away and they're notified."
              : "We'll email them a link to claim the tokens once they sign in."}
          </p>
        </div>

        <div>
          <label className={labelCls} htmlFor="gift-msg">
            Message (optional)
          </label>
          <input id="gift-msg" className={input} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Happy birthday!" maxLength={200} />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-3">
          <Button variant="secondary" size="md" onClick={onClose} className="flex-1" disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={submit} className="flex-1" disabled={loading}>
            {loading ? "Starting…" : "Continue to payment"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
