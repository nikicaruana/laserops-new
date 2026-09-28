"use client";

/**
 * components/match-report/StoryPreviewGallery.tsx
 * --------------------------------------------------------------------
 * Admin-only: renders all four generated story images. Clicking one opens it
 * full screen, where it can be shared (native share sheet on mobile) or
 * downloaded. Uses the PREVIEW sample report.
 */
import { useEffect, useState } from "react";
import { STORY_TEMPLATES, type StoryTemplate } from "@/lib/story/meta";
import { canShareFile, downloadFile, fetchStoryFile, shareFile, storyFileName } from "@/lib/story/share";
import { cn } from "@/lib/cn";

export function StoryPreviewGallery({ ops }: { ops: string }) {
  const [openKey, setOpenKey] = useState<StoryTemplate | null>(null);

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
        {STORY_TEMPLATES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setOpenKey(t.key)}
            className="flex flex-col gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <img
              src={`/api/story/PREVIEW/${encodeURIComponent(ops)}?t=${t.key}`}
              alt={`${t.label} story layout`}
              className="w-full rounded-sm portal-card transition-transform hover:scale-[1.02]"
              style={{ aspectRatio: "9 / 16" }}
            />
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-[0.1em] text-text">{t.label}</span>
              <span className="text-[0.65rem] leading-tight text-text-muted">Tap to view + share</span>
            </div>
          </button>
        ))}
      </div>
      {openKey && <StoryLightbox ops={ops} template={openKey} onClose={() => setOpenKey(null)} />}
    </>
  );
}

function StoryLightbox({ ops, template, onClose }: { ops: string; template: StoryTemplate; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const src = `/api/story/PREVIEW/${encodeURIComponent(ops)}?t=${template}`;
  const fileName = storyFileName(ops, template);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

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
        setStatus("Saved to your device.");
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") setStatus("Something went wrong. Try Download instead.");
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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Story image full screen"
      onClick={onClose}
      className="fixed inset-0 z-[120] flex flex-col items-center justify-center gap-4 bg-black/95 p-4 sm:p-6"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-border-strong text-2xl leading-none text-text-muted hover:text-accent"
      >
        ×
      </button>

      <img
        src={src}
        alt="Story preview"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[80vh] w-auto rounded-sm border border-border-strong"
        style={{ aspectRatio: "9 / 16" }}
      />

      <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-md flex-col items-center gap-2">
        <div className="flex w-full gap-2">
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
            className={cn(
              "flex flex-1 items-center justify-center rounded-sm border border-border-strong px-4 py-2.5 text-sm font-bold uppercase tracking-[0.12em] text-text transition-colors hover:border-accent hover:text-accent disabled:opacity-60",
            )}
          >
            Download
          </button>
        </div>
        <p className="text-center text-[0.7rem] leading-relaxed text-text-muted">
          {status || "On a phone, tap Share then pick Instagram → Stories."}
        </p>
      </div>
    </div>
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
