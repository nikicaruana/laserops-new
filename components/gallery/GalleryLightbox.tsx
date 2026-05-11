"use client";

import { useEffect, useRef, useState } from "react";

/**
 * GalleryLightbox
 * --------------------------------------------------------------------
 * Full-screen image lightbox. Follows the ArmoryDetailDialog pattern:
 * the native <dialog> element is always mounted; we call showModal() /
 * close() via useEffect when the `index` prop changes null ↔ number.
 *
 * Features:
 *   - Backdrop click closes (click directly on <dialog>, not the panel)
 *   - ESC key closes (native <dialog> behaviour)
 *   - ← / → keyboard navigation
 *   - Touch swipe left/right to navigate (50px threshold)
 *   - Previous / Next buttons
 *   - Image counter: "3 / 14"
 *   - Caption below image if present
 *   - `currentIndex` state updated separately from prop so prev/next
 *     feel instant without waiting for parent state update
 */

export type LightboxImage = {
  secureUrl: string;
  width: number;
  height: number;
  caption?: string;
};

type Props = {
  images: LightboxImage[];
  /** null = closed */
  index: number | null;
  onClose: () => void;
};

export function GalleryLightbox({ images, index, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Sync open/close to the `index` prop.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (index !== null && !d.open && typeof d.showModal === "function") {
      setCurrentIndex(index);
      d.showModal();
    } else if (index === null && d.open) {
      d.close();
    }
  }, [index]);

  // Also sync currentIndex when index prop changes while already open
  // (e.g. parent programmatically changes the index).
  useEffect(() => {
    if (index !== null) setCurrentIndex(index);
  }, [index]);

  // Backdrop click and native close.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;

    function handleBackdropClick(e: MouseEvent) {
      if (!d) return;
      if (e.target === d) onClose();
    }
    function handleNativeClose() {
      onClose();
    }

    d.addEventListener("click", handleBackdropClick);
    d.addEventListener("close", handleNativeClose);
    return () => {
      d.removeEventListener("click", handleBackdropClick);
      d.removeEventListener("close", handleNativeClose);
    };
  }, [onClose]);

  // Keyboard navigation.
  useEffect(() => {
    if (index === null) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        setCurrentIndex((i) => (i - 1 + images.length) % images.length);
      } else if (e.key === "ArrowRight") {
        setCurrentIndex((i) => (i + 1) % images.length);
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [index, images.length]);

  // Touch swipe.
  const touchStartX = useRef<number | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) {
      setCurrentIndex((i) => (i + 1) % images.length);
    } else {
      setCurrentIndex((i) => (i - 1 + images.length) % images.length);
    }
  }

  function handleClose() {
    const d = dialogRef.current;
    if (d?.open) d.close();
    else onClose();
  }

  const img = images[currentIndex];
  const total = images.length;

  return (
    <dialog
      ref={dialogRef}
      className="m-auto h-full max-h-full w-full max-w-full bg-transparent p-0 text-text backdrop:bg-black/90 backdrop:backdrop-blur-sm"
      style={{ border: "none" }}
    >
      {/* Outer wrapper — full-screen flex, click on dark area closes */}
      <div
        className="flex h-full w-full flex-col items-center justify-center px-4 py-12 sm:px-8"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Top bar: counter + close */}
        <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-5 py-4">
          <p className="font-mono text-xs font-semibold tabular-nums text-white/60">
            {currentIndex + 1}&thinsp;/&thinsp;{total}
          </p>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close lightbox"
            className="rounded p-1.5 text-white/70 transition-colors hover:text-white focus:outline-none focus:ring-1 focus:ring-white/40"
          >
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="square"
            >
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        {/* Main image — constrained so it never overflows the viewport */}
        {img && (
          <div className="relative flex w-full flex-1 flex-col items-center justify-center gap-3">
            <img
              key={img.secureUrl}
              src={img.secureUrl}
              alt={img.caption ?? "Gallery image"}
              width={img.width || undefined}
              height={img.height || undefined}
              className="max-h-[75vh] max-w-full object-contain"
              style={{
                // Smooth crossfade when switching images.
                transition: "opacity 0.15s ease",
              }}
            />
            {img.caption && (
              <p className="max-w-lg text-center text-sm text-white/60">
                {img.caption}
              </p>
            )}
          </div>
        )}

        {/* Prev / Next buttons — absolute positioned left/right of the image */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() =>
                setCurrentIndex((i) => (i - 1 + total) % total)
              }
              aria-label="Previous image"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded p-2 text-white/60 transition-colors hover:text-white focus:outline-none focus:ring-1 focus:ring-white/40 sm:left-5"
            >
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="square"
              >
                <path d="M10 3L5 8l5 5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => (i + 1) % total)}
              aria-label="Next image"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-2 text-white/60 transition-colors hover:text-white focus:outline-none focus:ring-1 focus:ring-white/40 sm:right-5"
            >
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="square"
              >
                <path d="M6 3l5 5-5 5" />
              </svg>
            </button>
          </>
        )}
      </div>
    </dialog>
  );
}
