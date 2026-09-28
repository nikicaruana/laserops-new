"use client";

/**
 * components/portal/GunBookingModal.tsx
 * --------------------------------------------------------------------
 * Focused popup for booking a gun: dims the page, shows the gun carousel with
 * per-game stock (fully-booked guns are disabled), and Save / Cancel. Loads
 * live availability (match_gun_availability) and books via book_match_gun, which
 * re-checks stock server-side. Dismiss via backdrop / Cancel / Escape.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { GunCarousel, type CarouselGun } from "@/components/portal/GunCarousel";
import { Modal } from "@/components/ui/Modal";

export function GunBookingModal({
  matchId,
  guns,
  currentGun,
  onClose,
}: {
  matchId: string;
  guns: CarouselGun[];
  currentGun: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(currentGun ?? "");
  const [avail, setAvail] = useState<Record<string, { stock: number | null; booked: number }>>({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    (async () => {
      const { data } = await supabase.rpc("match_gun_availability", { p_match_id: matchId });
      if (!active) return;
      const map: Record<string, { stock: number | null; booked: number }> = {};
      for (const r of (data ?? []) as { name: string; stock: number | null; booked: number }[]) {
        map[r.name] = { stock: r.stock, booked: r.booked };
      }
      setAvail(map);
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [matchId]);

  // A gun is sold out for me when others' bookings already fill the stock
  // (my own current booking of it doesn't count against me).
  const withStock: CarouselGun[] = guns.map((g) => {
    const a = avail[g.name];
    const othersBooked = a ? a.booked - (currentGun === g.name ? 1 : 0) : 0;
    const soldOut = Boolean(a && a.stock != null && othersBooked >= a.stock);
    return { ...g, soldOut };
  });
  const selectedSoldOut = withStock.find((g) => g.name === selected)?.soldOut ?? false;

  async function save() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("book_match_gun", { p_match_id: matchId, p_gun: selected || null });
    setBusy(false);
    const res = (data ?? {}) as { ok?: boolean; error?: string };
    if (err || !res.ok) return setError(res.error || err?.message || "Couldn't book that gun.");
    router.refresh();
    onClose();
  }

  return (
    <Modal title="Book your gun" onClose={onClose} maxWidth="max-w-lg">
      {!loaded ? (
        <p className="py-8 text-center text-sm text-text-subtle">Loading availability…</p>
      ) : (
        <GunCarousel guns={withStock} value={selected} onChange={setSelected} />
      )}

      {selectedSoldOut && <p className="mt-2 text-xs text-red-400">That gun is fully booked – pick another.</p>}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      <div className="mt-5 flex items-center gap-3">
        <Button type="button" size="md" onClick={save} disabled={busy || selectedSoldOut || !selected}>
          {busy ? "Saving…" : "Save gun"}
        </Button>
        <Button type="button" size="md" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
      </div>
    </Modal>
  );
}
