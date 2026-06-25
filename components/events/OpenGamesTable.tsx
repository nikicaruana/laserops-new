"use client";

import { useState, useEffect, useRef } from "react";
import type { OpenGame } from "@/lib/cms/open-games";
import { formatGameDate } from "@/lib/cms/open-games";

/**
 * OpenGamesTable
 * --------------------------------------------------------------------
 * Client component — renders the schedule table + the More Info modal.
 * All data is passed from the server page as props; no fetching here.
 *
 * Double XP rows get a subtle yellow left-border accent + faint yellow tint.
 * Status shown as a coloured pill chip.
 * More Info button opens a native <dialog> modal (centred via m-auto)
 * with either a poster image or text from the sheet.
 * --------------------------------------------------------------------
 */

type Props = {
  games: OpenGame[];
};

/* ─── Status chip colours ─────────────────────────────────────────── */
function StatusChip({ status }: { status: string }) {
  const s = status.toLowerCase();
  let cls = "bg-neutral-800 text-neutral-400"; // default / unknown
  if (s === "open") cls = "bg-green-900/60 text-green-300";
  else if (s === "full") cls = "bg-yellow-900/60 text-yellow-300";
  else if (s === "completed") cls = "bg-neutral-800 text-neutral-400";
  else if (s === "cancelled") cls = "bg-red-900/60 text-red-400";

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.1em] ${cls}`}
    >
      {status}
    </span>
  );
}

/* ─── More Info modal ─────────────────────────────────────────────── */
function MoreInfoModal({
  game,
  onClose,
}: {
  game: OpenGame | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Sync open/close with the native <dialog> API
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (game) {
      if (!el.open) el.showModal();
    } else {
      if (el.open) el.close();
    }
  }, [game]);

  // Close on backdrop click (click directly on the <dialog>, not the inner panel)
  function handleDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) onClose();
  }

  const hasImage = game?.moreInfoImage && game.moreInfoImage !== "";
  const hasText = game?.moreInfoText && game.moreInfoText !== "";

  return (
    <dialog
      ref={dialogRef}
      onClick={handleDialogClick}
      // m-auto centres the dialog in the viewport (horizontal + vertical)
      className="m-auto max-h-[90vh] w-full max-w-xl rounded-sm border border-border bg-bg p-0 text-text backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-accent px-5 py-3">
          <h2 className="text-base font-extrabold uppercase tracking-tight text-bg">
            {game
              ? `${game.type || "Open Game"} — ${formatGameDate(game.date)}`
              : ""}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-4 flex h-7 w-7 items-center justify-center rounded-sm text-bg/70 transition-colors hover:bg-bg/20 hover:text-bg"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5">
          {hasImage ? (
            /* Poster image — fills the modal width, preserves aspect ratio */
            <img
              src={game!.moreInfoImage}
              alt={`${game!.type} match poster — ${formatGameDate(game!.date)}`}
              className="mx-auto block max-h-[70vh] w-full rounded-sm object-contain"
            />
          ) : hasText ? (
            /* Text body — pre-line so sheet newlines are preserved */
            <p className="whitespace-pre-line text-sm leading-relaxed text-text-muted">
              {game!.moreInfoText}
            </p>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}

/* ─── Main table component ────────────────────────────────────────── */
export function OpenGamesTable({ games }: Props) {
  const [activeGame, setActiveGame] = useState<OpenGame | null>(null);

  if (games.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-text-muted">
        No open games are scheduled right now. Check back soon or{" "}
        <a
          href="https://chat.whatsapp.com/"
          className="font-semibold text-accent underline underline-offset-4 hover:opacity-80"
        >
          join the WhatsApp community
        </a>{" "}
        to be notified first.
      </p>
    );
  }

  return (
    <>
      {/* On desktop: min-width forces horizontal scroll rather than
          collapsing columns. On mobile: no min-width, columns narrow
          naturally and text is allowed to wrap. */}
      <div className="overflow-x-auto rounded-sm border border-border">
        <table className="w-full border-collapse text-sm sm:min-w-[640px]">
          {/* ── Header ─────────────────────────────────────────────── */}
          <thead>
            <tr className="bg-accent">
              {["Date", "Time", "Type", "Status", "Sign Up", "Match Report", "More Info"].map(
                (col) => (
                  <th
                    key={col}
                    className="px-2 py-2 text-left text-[0.6rem] font-bold uppercase tracking-[0.1em] text-bg sm:whitespace-nowrap sm:px-4 sm:py-3 sm:text-[0.65rem] sm:tracking-[0.14em]"
                  >
                    {col}
                  </th>
                ),
              )}
            </tr>
          </thead>

          {/* ── Rows ───────────────────────────────────────────────── */}
          <tbody>
            {games.map((game, idx) => {
              const hasMoreInfo =
                (game.moreInfoImage && game.moreInfoImage !== "") ||
                (game.moreInfoText && game.moreInfoText !== "");

              return (
                <tr
                  key={`${game.date}-${game.time}-${idx}`}
                  className={[
                    // Alternating row shade
                    idx % 2 === 0 ? "bg-bg" : "bg-bg-elevated",
                    // Double XP: subtle yellow left-border + faint yellow tint
                    game.isDoubleXP
                      ? "border-l-2 border-accent/50 !bg-accent/[0.06]"
                      : "",
                    "border-b border-border last:border-b-0",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {/* Date */}
                  <td className="px-2 py-2 font-mono text-[0.65rem] text-text sm:whitespace-nowrap sm:px-4 sm:py-3 sm:text-xs">
                    {formatGameDate(game.date)}
                  </td>

                  {/* Time — nowrap on desktop; wraps fine on mobile */}
                  <td className="px-2 py-2 font-mono text-[0.65rem] text-text sm:whitespace-nowrap sm:px-4 sm:py-3 sm:text-xs">
                    {game.time || "—"}
                  </td>

                  {/* Type — yellow for Double XP rows */}
                  <td
                    className={`px-2 py-2 text-[0.65rem] font-semibold sm:px-4 sm:py-3 sm:text-xs ${
                      game.isDoubleXP ? "text-accent" : "text-text"
                    }`}
                  >
                    {game.type || "—"}
                  </td>

                  {/* Status */}
                  <td className="px-2 py-2 sm:px-4 sm:py-3">
                    {game.status ? (
                      <StatusChip status={game.status} />
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>

                  {/* Sign Up */}
                  <td className="px-2 py-2 sm:px-4 sm:py-3">
                    {game.signupLink ? (
                      <a
                        href={game.signupLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block rounded-sm bg-accent px-2 py-1 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-bg transition-opacity hover:opacity-80 sm:whitespace-nowrap sm:px-3 sm:text-[0.65rem] sm:tracking-[0.1em]"
                      >
                        Sign Up →
                      </a>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>

                  {/* Match Report */}
                  <td className="px-2 py-2 sm:px-4 sm:py-3">
                    {game.matchReportLink ? (
                      <a
                        href={game.matchReportLink}
                        className="text-[0.65rem] font-semibold text-accent underline underline-offset-4 hover:opacity-80 sm:whitespace-nowrap sm:text-xs"
                      >
                        View Report
                      </a>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>

                  {/* More Info */}
                  <td className="px-2 py-2 sm:px-4 sm:py-3">
                    {hasMoreInfo ? (
                      <button
                        onClick={() => setActiveGame(game)}
                        className="inline-block rounded-sm border border-border px-2 py-1 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-text-muted transition-colors hover:border-accent hover:text-accent sm:whitespace-nowrap sm:px-3 sm:text-[0.65rem] sm:tracking-[0.1em]"
                      >
                        More Info
                      </button>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal — always mounted, shown/hidden via native <dialog> API */}
      <MoreInfoModal game={activeGame} onClose={() => setActiveGame(null)} />
    </>
  );
}
