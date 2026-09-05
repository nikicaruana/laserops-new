"use client";

/**
 * components/match-report/ShareStoryButton.tsx
 * --------------------------------------------------------------------
 * Lets a player share their match summary as a 1080x1920 story image to
 * Instagram / Facebook / WhatsApp etc. Opens the standard Modal with a layout
 * picker + live preview. "Share" uses the Web Share API (native share sheet ->
 * Instagram Stories on mobile); falls back to a download on desktop / browsers
 * without file sharing. There is no web API to auto-post to a personal story,
 * so the share sheet is the intended one-tap path.
 */
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { STORY_TEMPLATES, type StoryTemplate } from "@/lib/story/meta";
import { canShareFile, downloadFile, fetchStoryFile, shareFile, storyFileName } from "@/lib/story/share";
import { cn } from "@/lib/cn";

export function ShareStoryButton({
  matchId,
  ops,
  className,
}: {
  matchId: string;
  ops: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 rounded-sm border border-accent px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-accent transition-colors hover:bg-accent hover:text-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          className,
        )}
      >
        <ShareIcon />
        Share to Story
      </button>
      {open && <ShareStoryModal matchId={matchId} ops={ops} onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareStoryModal({ matchId, ops, onClose }: { matchId: string; ops: string; onClose: () => void }) {
  const [template, setTemplate] = useState<StoryTemplate>("personal");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");

  const src = useMemo(
    () => `/api/story/${encodeURIComponent(matchId)}/${encodeURIComponent(ops)}?t=${template}`,
    [matchId, ops, template],
  );
  const fileName = storyFileName(ops, template);

  async function handleShare() {
    setBusy(true);
    setStatus("");
    try {
      const file = await fetchStoryFile(src, fileName);
      if (canShareFile(file)) {
        await shareFile(file);
        setStatus("Shared.");
      } else {
        downloadFile(file);
        setStatus("Saved to your device. Open Instagram and add it to your story.");
      }
    } catch (err) {
      // User cancelling the native share sheet throws AbortError - not an error.
      if ((err as Error)?.name !== "AbortError") {
        setStatus("Something went wrong. Try the download button instead.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload() {
    setBusy(true);
    setStatus("");
    try {
      downloadFile(await fetchStoryFile(src, fileName));
      setStatus("Saved to your device.");
    } catch {
      setStatus("Could not generate the image. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Share to Story" onClose={onClose} maxWidth="max-w-lg">
      {/* Layout picker */}
      <div className="grid grid-cols-2 gap-2">
        {STORY_TEMPLATES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTemplate(t.key)}
            className={cn(
              "flex flex-col items-start rounded-sm border px-3 py-2 text-left transition-colors",
              template === t.key ? "border-accent bg-accent/10" : "border-border hover:border-border-strong",
            )}
          >
            <span className={cn("text-xs font-bold uppercase tracking-[0.1em]", template === t.key ? "text-accent" : "text-text")}>
              {t.label}
            </span>
            <span className="mt-0.5 text-[0.65rem] leading-tight text-text-muted">{t.blurb}</span>
          </button>
        ))}
      </div>

      {/* Preview (9:16). key forces a reload spinner-free swap when template changes. */}
      <div className="mt-4 flex justify-center">
        <img
          key={src}
          src={src}
          alt="Story preview"
          className="max-h-[52vh] w-auto rounded-sm border border-border-strong bg-bg-elevated"
          style={{ aspectRatio: "9 / 16" }}
        />
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleShare}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-sm bg-accent px-4 py-2.5 text-sm font-bold uppercase tracking-[0.12em] text-bg transition-colors hover:bg-accent-soft disabled:opacity-60"
        >
          <ShareIcon />
          {busy ? "Working…" : "Share"}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={busy}
          className="flex flex-1 items-center justify-center rounded-sm border border-border-strong px-4 py-2.5 text-sm font-bold uppercase tracking-[0.12em] text-text transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
        >
          Download
        </button>
      </div>

      <p className="mt-3 text-center text-[0.7rem] leading-relaxed text-text-muted">
        {status || "On a phone, tap Share then pick Instagram → Stories. On desktop, download the image and upload it from your phone."}
      </p>
    </Modal>
  );
}

function ShareIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M16 6l-4-4-4 4" />
      <path d="M12 2v14" />
    </svg>
  );
}
