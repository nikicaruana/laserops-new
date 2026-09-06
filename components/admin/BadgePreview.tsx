"use client";

/**
 * components/admin/BadgePreview.tsx
 * --------------------------------------------------------------------
 * A badge thumbnail that expands into a centered lightbox popup on click.
 * Dismiss by clicking the backdrop, the close button, or Escape. Used in the
 * streak management screens so admins can eyeball the full-size art.
 */
import { useEffect, useState } from "react";
import { cldImage } from "@/lib/cld";

export function BadgePreview({
  src,
  alt = "",
  className = "",
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={alt ? `Expand ${alt}` : "Expand badge"}
        className={`group flex shrink-0 cursor-zoom-in items-center justify-center overflow-hidden ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cldImage(src, { w: 384 })} alt={alt} className="max-h-full max-w-full object-contain transition-transform group-hover:scale-110" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cldImage(src, { w: 800 })} alt={alt} className="max-h-[85vh] max-w-[85vw] object-contain" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close preview"
              className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full border border-border-strong bg-bg text-lg text-text hover:text-accent"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}
