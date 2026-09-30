"use client";

/**
 * components/portal/CreatePrivateBookingForm.tsx
 * --------------------------------------------------------------------
 * Player-facing private booking request. Contact details are prefilled from the
 * account (read-only here; edited in the profile). Player picks a date, start
 * time (3h), and headcount; we create an unlisted 'tentative' match via the
 * create_private_booking RPC for an admin to price and confirm.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { AvailabilityPicker } from "@/components/portal/AvailabilityPicker";
import { AddPhoneModal } from "@/components/portal/AddPhoneModal";

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

const fmtMins = (mins: number) => `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
const addHours = (hhmm: string, hrs: number) => {
  const [h, m] = hhmm.split(":").map(Number);
  return fmtMins((h * 60 + m + hrs * 60) % 1440);
};

export function CreatePrivateBookingForm({
  opsTag,
  fullName,
  phone,
}: {
  opsTag: string | null;
  fullName: string | null;
  phone: string | null;
}) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [headcount, setHeadcount] = useState("10");
  const [title, setTitle] = useState("");
  const [titleDirty, setTitleDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phonePrompt, setPhonePrompt] = useState(false);
  const [cfg, setCfg] = useState({ sessionMinutes: 180, bufferMinutes: 60 });
  useEffect(() => {
    const supabase = createClient();
    supabase.from("pricing_config").select("session_minutes, booking_buffer_minutes").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setCfg({ sessionMinutes: Number(data.session_minutes) || 180, bufferMinutes: Number(data.booking_buffer_minutes) || 60 });
    });
  }, []);
  const gameHours = cfg.sessionMinutes / 60;

  const endTime = startTime ? addHours(startTime, gameHours) : "";

  useEffect(() => {
    if (titleDirty) return;
    setTitle(opsTag ? `${opsTag}'s Private Booking` : "Private Booking");
  }, [opsTag, titleDirty]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submit();
  }

  async function submit() {
    setError(null);
    if (!date || !startTime) {
      setError("Pick a date and start time.");
      return;
    }
    const when = new Date(`${date}T${startTime}:00`);
    if (Number.isNaN(when.getTime())) {
      setError("That date and time isn't valid.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("create_private_booking", {
      p_title: title.trim() || null,
      p_scheduled_at: when.toISOString(),
      p_headcount: Number(headcount) || 1,
    });
    setSaving(false);
    if (err || !data) {
      setError(err?.message || "Couldn't send your booking request.");
      if (err && /mobile number/i.test(err.message)) setPhonePrompt(true);
      return;
    }
    router.push(`/player-portal/games/${data}`);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
      <fieldset className="portal-card px-5 py-5">
        <legend className="px-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">Your details</legend>
        <p className="text-sm text-text">{fullName || opsTag || "Your account"}</p>
        <p className="text-sm text-text-muted">{phone || "No phone on file"}</p>
        <p className="mt-2 text-[0.65rem] text-text-subtle">
          We&apos;ll use your account contact details.{" "}
          <Link href="/player-portal/profile" className="text-accent hover:text-accent-soft">Update them</Link> if needed.
        </p>
      </fieldset>

      <fieldset className="portal-card px-5 py-5">
        <legend className="px-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">When</legend>
        <AvailabilityPicker
          value={{ date, time: startTime }}
          onChange={(d, t) => { setDate(d); setStartTime(t); }}
          sessionHours={gameHours}
          bufferMinutes={cfg.bufferMinutes}
        />
        <p className="mt-3 text-[0.65rem] text-text-subtle">
          {endTime ? `Runs ${gameHours} hours, until ${endTime}.` : "Sessions run 3 hours - pick a date and start time we're open."}
        </p>
        <div className="mt-4 max-w-[12rem]">
          <label className={lbl}>How many players</label>
          <input type="number" min="1" className={input} value={headcount} onChange={(e) => setHeadcount(e.target.value)} onFocus={(e) => e.target.select()} />
        </div>
        {Number(headcount) < 10 ? (
          <p className="mt-2 text-[0.72rem] font-semibold text-accent">
            Private bookings have a 10-player minimum. Groups under 10 are charged the &euro;350 flat rate.
          </p>
        ) : (
          <p className="mt-2 text-[0.72rem] text-text-subtle">10-player minimum (&euro;350 flat rate for smaller groups).</p>
        )}
      </fieldset>

      <fieldset className="portal-card px-5 py-5">
        <legend className="px-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">Booking name</legend>
        <div className="mb-1.5 flex items-center justify-between">
          <label className={`${lbl} mb-0`}>Title</label>
          {titleDirty && (
            <button type="button" onClick={() => setTitleDirty(false)} className="text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-text-subtle hover:text-accent">
              Reset to auto
            </button>
          )}
        </div>
        <input
          className={input}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleDirty(true);
          }}
          placeholder="e.g. Alex's birthday"
        />
      </fieldset>

      {error && <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-4">
        <Button type="submit" size="md" disabled={saving}>
          {saving ? "Sending…" : "Request booking"}
        </Button>
        <p className="text-[0.65rem] text-text-subtle">We&apos;ll confirm the price and details with you.</p>
      </div>

      {phonePrompt && (
        <AddPhoneModal
          onClose={() => setPhonePrompt(false)}
          onSaved={() => { setPhonePrompt(false); setError(null); router.refresh(); submit(); }}
        />
      )}
    </form>
  );
}
