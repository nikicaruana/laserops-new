"use client";

/**
 * components/ui/Modal.tsx
 * --------------------------------------------------------------------
 * The standard popup for the app: a centered panel over a dark, blurred
 * backdrop that dims everything else. Use this for any focus popup (help,
 * pickers, confirmations) so they look and behave the same everywhere.
 * Dismiss via backdrop click, the close button, or Escape. Locks page scroll
 * while open. Renders nothing on its own; the caller controls when it mounts.
 */
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Modal({
  title,
  onClose,
  children,
  maxWidth = "max-w-md",
}: {
  title?: string;
  onClose: () => void;
  children: ReactNode;
  /** Tailwind max-w-* for the panel (default max-w-md). */
  maxWidth?: string;
}) {
  // Portal to <body> so the fixed overlay can't be scoped/clipped by an ancestor
  // with transform/filter/backdrop-filter (which would otherwise leave the page
  // behind interactive). Mount-guarded for SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Scroll lock: overflow:hidden alone doesn't stop touch scroll on iOS, so pin
  // the body with position:fixed (offset by the current scroll) and restore on
  // close. Runs once for the modal's lifetime (mount -> unmount).
  useEffect(() => {
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = {
      position: body.style.position, top: body.style.top, left: body.style.left,
      right: body.style.right, width: body.style.width, overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      Object.assign(body.style, prev);
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidth} max-h-[85vh] overflow-y-auto border border-border-strong bg-bg p-5 shadow-2xl sm:p-6`}
      >
        {title && (
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-accent">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 text-lg text-text-muted hover:text-accent">
              ×
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
