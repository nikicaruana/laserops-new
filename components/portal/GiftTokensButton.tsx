"use client";

/**
 * components/portal/GiftTokensButton.tsx
 * --------------------------------------------------------------------
 * Opens the "gift game tokens" modal from the store page.
 */
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { GiftTokensModal } from "@/components/portal/GiftTokensModal";

type Bundle = { id: string; name: string; tokens: number; price_eur: number };

export function GiftTokensButton({ bundles, singleTokenPrice }: { bundles: Bundle[]; singleTokenPrice: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="md" onClick={() => setOpen(true)}>
        Gift game tokens
      </Button>
      {open && <GiftTokensModal bundles={bundles} singleTokenPrice={singleTokenPrice} onClose={() => setOpen(false)} />}
    </>
  );
}
