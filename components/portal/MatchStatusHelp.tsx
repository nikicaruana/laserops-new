"use client";

/**
 * components/portal/MatchStatusHelp.tsx
 * --------------------------------------------------------------------
 * A small "?" next to a match's status badge. Tapping it opens a centered
 * popup (the shared Modal) explaining what each game state means, dimming the
 * rest of the screen. Each heading is the actual colour-coded status badge so
 * players can match it to what they see on a game.
 */
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { MatchStatusBadge } from "@/components/admin/MatchStatusBadge";

const STATES: { key: string; desc: string }[] = [
  { key: "tentative", desc: "Still gathering players. Not enough have signed up yet, so nothing's locked in." },
  { key: "awaiting_confirm", desc: "Enough players are in; we're confirming the booking on our end." },
  { key: "confirmed", desc: "The game is on. Payment is open, so pay online now to confirm your place." },
  { key: "live", desc: "The game is running now. Tap in with the entry code the marshal calls out." },
  { key: "completed", desc: "The game has finished. Your stats and match report show up here." },
  { key: "cancelled", desc: "This game was called off." },
];

export function MatchStatusHelp() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="What do the game states mean?"
        className="flex h-5 w-5 items-center justify-center rounded-full border border-accent bg-accent/15 text-[0.65rem] font-bold text-accent shadow-[0_0_0_2px_rgba(255,222,0,0.12)] transition-colors hover:bg-accent hover:text-bg"
      >
        ?
      </button>
      {open && (
        <Modal title="What the game states mean" onClose={() => setOpen(false)}>
          <ul className="space-y-4">
            {STATES.map((s) => (
              <li key={s.key}>
                <MatchStatusBadge status={s.key} />
                <p className="mt-1.5 text-xs leading-relaxed text-text-muted">{s.desc}</p>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  );
}
