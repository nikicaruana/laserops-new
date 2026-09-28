"use client";

/**
 * components/portal/BuyBundleButton.tsx
 * --------------------------------------------------------------------
 * Starts a hosted checkout for a token bundle: POSTs the bundle id to
 * /api/store/checkout and redirects to the returned payment URL. The server
 * re-reads the price and the webhook grants the tokens, so nothing here can set
 * a balance. Disabled with a message when online payment isn't configured yet.
 */
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function BuyBundleButton({ bundleId, label = "Buy" }: { bundleId: string; label?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundleId }),
      });
      const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
      if (!data.ok || !data.url) {
        setError(data.error || "Couldn't start checkout.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <Button variant="primary" size="md" className="w-full" onClick={buy} disabled={loading}>
        {loading ? "Starting…" : label}
      </Button>
      {error && <p className="mt-2 text-center text-xs text-red-400">{error}</p>}
    </div>
  );
}
