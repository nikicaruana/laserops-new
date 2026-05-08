"use client";

import { useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/** Generate HH:MM slots from 09:00 to 17:30 at 30-min intervals. */
function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 9; h <= 17; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 17 || true) slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  // Slice to include 17:30 but nothing after
  return slots.filter((s) => s <= "17:30");
}

/** Add 3 hours to a HH:MM string. */
function addThreeHours(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + 180;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const TIME_SLOTS = generateTimeSlots();

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-none border border-border bg-bg px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50";

const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Status = "idle" | "submitting" | "success" | "error";

export function BookingForm() {
  const [eventType, setEventType] = useState("Corporate Event");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState(TIME_SLOTS[0]);
  const [players, setPlayers] = useState("");
  const [comments, setComments] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const endTime = addThreeHours(startTime);
  const playerCount = parseInt(players, 10);
  const showMinFeeWarning = !isNaN(playerCount) && playerCount > 0 && playerCount < 10;

  const today = new Date().toISOString().split("T")[0];

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setStatus("submitting");
      setErrorMsg("");

      try {
        const res = await fetch("/api/booking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType,
            fullName,
            email,
            phone,
            companyName,
            date,
            startTime,
            endTime,
            players,
            comments,
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
    [eventType, fullName, email, phone, companyName, date, startTime, endTime, players, comments],
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
        <h2 className="text-xl font-extrabold tracking-tight text-text">Enquiry Sent!</h2>
        <p className="mt-2 text-sm text-text-muted">
          Thanks, {fullName}. We&apos;ll be in touch at{" "}
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

      {/* ── Event Type ──────────────────────────────── */}
      <div>
        <label htmlFor="eventType" className={labelClass}>
          Event Type <span className="text-accent">*</span>
        </label>
        <select
          id="eventType"
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          required
          className={inputClass}
        >
          <option>Corporate Event</option>
          <option>Birthday Party</option>
          <option>Group Booking</option>
        </select>
      </div>

      {/* ── Contact details ─────────────────────────── */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="fullName" className={labelClass}>
            Full Name <span className="text-accent">*</span>
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="John Smith"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>
            Email Address <span className="text-accent">*</span>
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="john@company.com"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="phone" className={labelClass}>
            Phone Number
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+356 9999 9999"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="companyName" className={labelClass}>
            Company Name
          </label>
          <input
            id="companyName"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Ltd."
            className={inputClass}
          />
        </div>
      </div>

      {/* ── Date & Time ─────────────────────────────── */}
      <div className="grid gap-6 sm:grid-cols-3">
        <div>
          <label htmlFor="date" className={labelClass}>
            Desired Date <span className="text-accent">*</span>
          </label>
          <input
            id="date"
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="startTime" className={labelClass}>
            Start Time <span className="text-accent">*</span>
          </label>
          <select
            id="startTime"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
            className={inputClass}
          >
            {TIME_SLOTS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="endTime" className={labelClass}>
            End Time
          </label>
          <input
            id="endTime"
            type="text"
            value={endTime}
            readOnly
            className={`${inputClass} cursor-default opacity-60`}
          />
        </div>
      </div>

      {/* ── Number of Players ───────────────────────── */}
      <div>
        <label htmlFor="players" className={labelClass}>
          Number of Players <span className="text-accent">*</span>
        </label>
        <input
          id="players"
          type="number"
          min={1}
          value={players}
          onChange={(e) => setPlayers(e.target.value)}
          required
          placeholder="e.g. 12"
          className={inputClass}
        />
        {showMinFeeWarning && (
          <p className="mt-2 text-xs text-amber-400">
            Sessions under 10 players are subject to a €300 minimum fee.
          </p>
        )}
      </div>

      {/* ── Comments ────────────────────────────────── */}
      <div>
        <label htmlFor="comments" className={labelClass}>
          Comments / Additional Info
        </label>
        <textarea
          id="comments"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={4}
          placeholder="Anything else we should know — dietary requirements, special requests, preferred game modes..."
          className={`${inputClass} resize-y`}
        />
      </div>

      {/* ── Submit ──────────────────────────────────── */}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="h-14 w-full bg-accent px-8 text-sm font-semibold uppercase tracking-[0.12em] text-bg shadow-[0_0_0_1px_var(--color-accent)] transition-all duration-200 hover:bg-accent-soft active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "submitting" ? "Sending…" : "Send Enquiry"}
      </button>

      <p className="text-center text-xs text-text-muted">
        We&apos;ll get back to you within 24 hours.
      </p>
    </form>
  );
}
