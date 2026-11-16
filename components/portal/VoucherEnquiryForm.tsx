"use client";

/**
 * components/portal/VoucherEnquiryForm.tsx
 * --------------------------------------------------------------------
 * Enquiry form for buying LaserOps Game Token gift vouchers in bulk. Posts to
 * /api/voucher-enquiry, which emails info@ and raises an admin alert. Works
 * signed-in or signed-out: when the player is signed in with an email + phone on
 * file we skip the contact fields and reply to those; otherwise we collect them.
 */
import { useMemo, useState, useCallback } from "react";

const inputClass =
  "w-full rounded-none border border-border bg-bg px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted";

type Status = "idle" | "submitting" | "success" | "error";

export function VoucherEnquiryForm({
  loggedIn,
  accountEmail,
  accountPhone,
  accountName,
}: {
  loggedIn: boolean;
  accountEmail: string | null;
  accountPhone: string | null;
  accountName: string | null;
}) {
  // When signed in with full contact details on file, we don't ask again.
  const haveContact = loggedIn && Boolean(accountEmail) && Boolean(accountPhone);

  const [vouchers, setVouchers] = useState(10);
  const [tokensPer, setTokensPer] = useState(1);
  const [name, setName] = useState(accountName ?? "");
  const [email, setEmail] = useState(accountEmail ?? "");
  const [phone, setPhone] = useState(accountPhone ?? "");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const totalTokens = useMemo(
    () => Math.max(0, Math.floor(Number(vouchers) || 0)) * Math.max(0, Math.floor(Number(tokensPer) || 0)),
    [vouchers, tokensPer],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setStatus("submitting");
      setErrorMsg("");
      try {
        const res = await fetch("/api/voucher-enquiry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vouchers,
            tokensPer,
            name: haveContact ? undefined : name,
            email: haveContact ? undefined : email,
            phone: haveContact ? undefined : phone,
            notes,
          }),
        });
        const data = (await res.json()) as { ok: boolean; error?: string };
        if (data.ok) {
          setStatus("success");
        } else {
          setErrorMsg(data.error ?? "Something went wrong. Please try again.");
          setStatus("error");
        }
      } catch {
        setErrorMsg("Network error. Please check your connection and try again.");
        setStatus("error");
      }
    },
    [vouchers, tokensPer, name, email, phone, notes, haveContact],
  );

  if (status === "success") {
    return (
      <div className="rounded-none border border-accent bg-bg-elevated px-8 py-10 text-center">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="mx-auto mb-4 h-10 w-10 text-accent"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <h2 className="text-xl font-extrabold tracking-tight text-text">Enquiry sent!</h2>
        <p className="mt-2 text-sm text-text-muted">
          Thanks{name ? `, ${name}` : ""}. We&apos;ll get back to you
          {haveContact && accountEmail ? (
            <>
              {" "}at <span className="font-semibold text-text">{accountEmail}</span>
            </>
          ) : email ? (
            <>
              {" "}at <span className="font-semibold text-text">{email}</span>
            </>
          ) : null}{" "}
          to arrange your vouchers.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {status === "error" && (
        <div className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
          {errorMsg}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="v-count" className={labelClass}>
            Number of vouchers <span className="text-accent">*</span>
          </label>
          <input
            id="v-count"
            type="number"
            min={1}
            max={500}
            step={1}
            value={vouchers}
            onChange={(e) => setVouchers(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="v-tokens" className={labelClass}>
            Game tokens per voucher <span className="text-accent">*</span>
          </label>
          <input
            id="v-tokens"
            type="number"
            min={1}
            max={50}
            step={1}
            value={tokensPer}
            onChange={(e) => setTokensPer(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            required
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-text-subtle">1 token = 1 game.</p>
        </div>
      </div>

      <div className="flex items-center justify-between border-l-2 border-accent/70 bg-accent/5 px-4 py-3 text-sm text-text-muted">
        <span>That&apos;s</span>
        <span className="font-semibold text-text">
          {Math.max(0, Math.floor(Number(vouchers) || 0))} voucher{vouchers === 1 ? "" : "s"} ·{" "}
          <span className="text-accent">{totalTokens}</span> game token{totalTokens === 1 ? "" : "s"} in total
        </span>
      </div>

      {haveContact ? (
        <p className="text-xs text-text-subtle">
          We&apos;ll reply to <span className="font-semibold text-text">{accountEmail}</span>
          {accountPhone ? (
            <>
              {" "}and may call <span className="font-semibold text-text">{accountPhone}</span>
            </>
          ) : null}
          . Update these in your{" "}
          <a href="/player-portal/profile" className="underline hover:text-accent">
            profile
          </a>{" "}
          if they&apos;ve changed.
        </p>
      ) : (
        <>
          <div>
            <label htmlFor="v-name" className={labelClass}>
              Your name
            </label>
            <input
              id="v-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Joe Borg"
              className={inputClass}
            />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="v-email" className={labelClass}>
                Email <span className="text-accent">*</span>
              </label>
              <input
                id="v-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="joe@example.com"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="v-phone" className={labelClass}>
                Phone <span className="text-accent">*</span>
              </label>
              <input
                id="v-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="+356 9999 1053"
                className={inputClass}
              />
            </div>
          </div>
        </>
      )}

      <div>
        <label htmlFor="v-notes" className={labelClass}>
          Anything else? <span className="font-normal normal-case tracking-normal text-text-subtle">(optional)</span>
        </label>
        <textarea
          id="v-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Occasion, deadline, custom design, or any questions."
          className={`${inputClass} resize-y`}
        />
      </div>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="h-14 w-full bg-accent px-8 text-sm font-semibold uppercase tracking-[0.12em] text-bg shadow-[0_0_0_1px_var(--color-accent)] transition-all duration-200 hover:bg-accent-soft active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "submitting" ? "Sending…" : "Send enquiry"}
      </button>

      <p className="text-center text-xs text-text-muted">
        No payment now - we&apos;ll get back to you to arrange it.
      </p>
    </form>
  );
}
