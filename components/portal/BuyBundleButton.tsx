"use client";

/**
 * components/portal/BuyBundleButton.tsx
 * --------------------------------------------------------------------
 * Requests a token bundle (no online payment). Calls request_token_pack, which
 * snapshots the bundle and alerts admins; the LaserOps team then settles the
 * payment (cash / Revolut) and grants the tokens by hand. On success the button
 * is replaced by a "we'll be in touch" confirmation.
 */
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export function BuyBundleButton({ bundleId, label = "Request this pack" }: { bundleId: string; label?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function request() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("request_token_pack", { p_bundle_id: bundleId });
    setLoading(false);
    if (err) {
      if ((err.message || "").includes("PHONE_REQUIRED")) {
        setError("Add a phone number to your profile first - taking you there…");
        setTimeout(() => { window.location.href = "/player-portal/profile?needphone=1"; }, 1300);
        return;
      }
      setError(err.message || "Couldn't send the request.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="w-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-center text-xs leading-relaxed text-emerald-300">
        Request sent. The LaserOps team will be in touch to arrange payment and add your tokens.
      </div>
    );
  }

  return (
    <div className="w-full">
      <Button variant="primary" size="md" className="w-full" onClick={request} disabled={loading}>
        {loading ? "Sending…" : label}
      </Button>
      {error && <p className="mt-2 text-center text-xs text-red-400">{error}</p>}
    </div>
  );
}
