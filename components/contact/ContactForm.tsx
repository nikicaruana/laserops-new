"use client";

import { useState, useCallback } from "react";

const inputClass =
  "w-full rounded-none border border-border bg-bg px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50";

const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted";

type Status = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setStatus("submitting");
      setErrorMsg("");

      try {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, message }),
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
    [name, email, message],
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
        <h2 className="text-xl font-extrabold tracking-tight text-text">Message Sent!</h2>
        <p className="mt-2 text-sm text-text-muted">
          Thanks, {name}. We&apos;ll get back to you at{" "}
          <span className="font-semibold text-text">{email}</span> shortly.
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
          <label htmlFor="contact-name" className={labelClass}>
            Full Name <span className="text-accent">*</span>
          </label>
          <input
            id="contact-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Joe Borg"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="contact-email" className={labelClass}>
            Email Address <span className="text-accent">*</span>
          </label>
          <input
            id="contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="joe@example.com"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="contact-message" className={labelClass}>
          Message <span className="text-accent">*</span>
        </label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={5}
          placeholder="What would you like to know?"
          className={`${inputClass} resize-y`}
        />
      </div>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="h-14 w-full bg-accent px-8 text-sm font-semibold uppercase tracking-[0.12em] text-bg shadow-[0_0_0_1px_var(--color-accent)] transition-all duration-200 hover:bg-accent-soft active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "submitting" ? "Sending…" : "Send Message"}
      </button>

      <p className="text-center text-xs text-text-muted">
        We&apos;ll get back to you within 24 hours.
      </p>
    </form>
  );
}
