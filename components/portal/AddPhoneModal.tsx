"use client";

/**
 * components/portal/AddPhoneModal.tsx
 * --------------------------------------------------------------------
 * Popup shown when a booking is blocked because the account has no mobile
 * number. Lets the player add it inline (PATCH /api/profile) without leaving the
 * page; on success the caller can retry the booking. A phone is required to book
 * so we can reach players if a game moves.
 */
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function AddPhoneModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const p = phone.trim();
    if (p.replace(/\D/g, "").length < 6) {
      setErr("Enter a valid mobile number.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: p }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || data.ok === false) throw new Error(data.error || "Couldn't save your number.");
      onSaved();
    } catch (e) {
      setBusy(false);
      setErr(e instanceof Error ? e.message : "Couldn't save your number.");
    }
  }

  return (
    <Modal title="Add your mobile number" onClose={onClose}>
      <p className="text-sm text-text-muted">
        We need a mobile number before you can book - so we can reach you if a game is confirmed or has to move. It stays private.
      </p>
      <label className="mt-4 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted">Mobile number</label>
      <input
        type="tel"
        inputMode="tel"
        autoFocus
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); }}
        placeholder="+356 9999 9999"
        className="mt-1.5 h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
      />
      {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
      <div className="mt-5 flex items-center gap-4">
        <Button type="button" size="sm" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save & continue"}
        </Button>
        <button type="button" onClick={onClose} className="text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle hover:text-accent">
          Cancel
        </button>
      </div>
    </Modal>
  );
}
