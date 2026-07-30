"use client";

/**
 * app/error.tsx
 * --------------------------------------------------------------------
 * App-wide error boundary (App Router). Catches client-side exceptions in
 * any route under the root layout and renders a clean, on-brand fallback
 * with a retry — instead of Next's raw "Application error: a client-side
 * exception has occurred" screen. `reset()` re-renders the failed segment
 * so a transient glitch recovers in place without a full reload.
 */
import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the real error in the console / server logs for diagnosis.
    console.error("[app/error] caught:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
        Something glitched
      </p>
      <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
        This page hit a snag
      </h1>
      <p className="max-w-md text-sm text-text-muted sm:text-base">
        A temporary error interrupted the page. Try again — if it keeps
        happening, let us know and we&rsquo;ll take a look.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="flex h-12 items-center justify-center gap-3 border border-accent bg-accent px-8 text-sm font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98]"
        >
          Try again
        </button>
        <Link
          href="/"
          className="flex h-12 items-center justify-center gap-3 border border-border-strong bg-bg px-8 text-sm font-semibold uppercase tracking-[0.12em] text-text transition-colors hover:border-accent"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
