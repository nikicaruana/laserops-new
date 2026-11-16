"use client";

/**
 * components/portal/GiftTokenForm.tsx
 * --------------------------------------------------------------------
 * Gift a game token (or half a game token) to another existing player, with an
 * optional message. No online payment: this raises a request the LaserOps team
 * settles by hand (same as a token pack), then the token lands on the recipient.
 * Recipient is chosen via the public search_players typeahead (ops tag / name).
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatEur } from "@/lib/money";
import { cldImage } from "@/lib/cld";

const inputClass =
  "w-full rounded-none border border-border bg-bg px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted";

type Player = { id: string; ops_tag: string | null; full_name: string | null; profile_pic_url: string | null };
type Status = "idle" | "submitting" | "success" | "error";

function PlayerAvatar({ p, size = 32 }: { p: Player; size?: number }) {
  const src = p.profile_pic_url ? cldImage(p.profile_pic_url, { w: size * 2, h: size * 2, trim: false }) : null;
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <div
      className="flex items-center justify-center rounded-full bg-bg-elevated text-xs font-bold text-text-muted"
      style={{ width: size, height: size }}
    >
      {(p.ops_tag || p.full_name || "?").slice(0, 1).toUpperCase()}
    </div>
  );
}

export function GiftTokenForm({ singleTokenPrice }: { singleTokenPrice: number }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Player[]>([]);
  const [searching, setSearching] = useState(false);
  const [recipient, setRecipient] = useState<Player | null>(null);
  const [amount, setAmount] = useState<1 | 0.5>(1);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const price = Math.round(singleTokenPrice * amount * 100) / 100;

  // Debounced recipient search.
  useEffect(() => {
    if (recipient) return; // not searching once one is picked
    if (timer.current) clearTimeout(timer.current);
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("search_players", { p_query: term });
      setResults((data as Player[] | null) ?? []);
      setSearching(false);
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, recipient]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!recipient) {
        setErrorMsg("Choose who the gift is for.");
        setStatus("error");
        return;
      }
      setStatus("submitting");
      setErrorMsg("");
      const supabase = createClient();
      const { error } = await supabase.rpc("request_token_gift", {
        p_recipient_account_id: recipient.id,
        p_tokens: amount,
        p_message: message.trim() || null,
      });
      if (error) {
        setErrorMsg(error.message || "Couldn't send your gift request. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("success");
    },
    [recipient, amount, message],
  );

  if (status === "success") {
    return (
      <div className="rounded-none border border-accent bg-bg-elevated px-8 py-10 text-center">
        <svg aria-hidden viewBox="0 0 24 24" className="mx-auto mb-4 h-10 w-10 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <h2 className="text-xl font-extrabold tracking-tight text-text">Gift request sent!</h2>
        <p className="mt-2 text-sm text-text-muted">
          We&apos;ll be in touch to arrange payment ({formatEur(price)}). Once it&apos;s settled,{" "}
          <span className="font-semibold text-text">{recipient?.ops_tag || recipient?.full_name || "your player"}</span>{" "}
          gets {amount === 1 ? "a game token" : "half a game token"} and a notification letting them know it&apos;s from you.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {status === "error" && (
        <div className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{errorMsg}</div>
      )}

      {/* Recipient */}
      <div>
        <label htmlFor="gift-recipient" className={labelClass}>
          Gift to <span className="text-accent">*</span>
        </label>
        {recipient ? (
          <div className="flex items-center gap-3 border border-accent bg-accent/5 px-4 py-3">
            <PlayerAvatar p={recipient} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text">{recipient.full_name || recipient.ops_tag}</p>
              {recipient.ops_tag && <p className="truncate font-mono text-xs text-text-subtle">{recipient.ops_tag}</p>}
            </div>
            <button
              type="button"
              onClick={() => {
                setRecipient(null);
                setQ("");
                setResults([]);
              }}
              className="text-xs font-semibold uppercase tracking-[0.1em] text-text-subtle hover:text-accent"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              id="gift-recipient"
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by ops tag or name"
              autoComplete="off"
              className={inputClass}
            />
            {(searching || results.length > 0) && q.trim().length >= 2 && (
              <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto border border-border-strong bg-bg shadow-lg">
                {searching && results.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-text-subtle">Searching…</p>
                ) : results.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-text-subtle">No players match that.</p>
                ) : (
                  results.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setRecipient(p);
                        setResults([]);
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-bg-elevated"
                    >
                      <PlayerAvatar p={p} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-text">{p.full_name || p.ops_tag}</p>
                        {p.ops_tag && <p className="truncate font-mono text-xs text-text-subtle">{p.ops_tag}</p>}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
        <p className="mt-1.5 text-xs text-text-subtle">They need a LaserOps account to receive the gift.</p>
      </div>

      {/* Amount */}
      <div>
        <span className={labelClass}>How much</span>
        <div className="grid gap-3 sm:grid-cols-2">
          {([1, 0.5] as const).map((v) => {
            const selected = amount === v;
            const p = Math.round(singleTokenPrice * v * 100) / 100;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(v)}
                aria-pressed={selected}
                className={`flex flex-col items-start border px-4 py-3 text-left transition ${
                  selected ? "border-accent bg-accent/10" : "border-border bg-bg hover:border-border-strong"
                }`}
              >
                <span className="text-sm font-bold text-text">{v === 1 ? "1 game token" : "Half a game token"}</span>
                <span className="text-xs text-text-muted">
                  {formatEur(p)} · {v === 1 ? "one full game" : "half a game"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Message */}
      <div>
        <label htmlFor="gift-message" className={labelClass}>
          Message <span className="font-normal normal-case tracking-normal text-text-subtle">(optional)</span>
        </label>
        <textarea
          id="gift-message"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 500))}
          rows={3}
          placeholder="Happy birthday! See you on the field."
          className={`${inputClass} resize-y`}
        />
        <p className="mt-1 text-right text-[0.65rem] text-text-subtle">{message.length}/500</p>
      </div>

      <button
        type="submit"
        disabled={status === "submitting" || !recipient}
        className="h-14 w-full bg-accent px-8 text-sm font-semibold uppercase tracking-[0.12em] text-bg shadow-[0_0_0_1px_var(--color-accent)] transition-all duration-200 hover:bg-accent-soft active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "submitting" ? "Sending…" : `Send gift request · ${formatEur(price)}`}
      </button>

      <p className="text-center text-xs text-text-muted">
        No payment now - we&apos;ll arrange it with you (cash or Revolut), then your gift is delivered.
      </p>
    </form>
  );
}
