/**
 * app/admin/locations/page.tsx
 * --------------------------------------------------------------------
 * Venues / locations admin: name + parking link + playing link, one default.
 * Used by match creation (default for community games, pre-selected for admins)
 * and by match reminders + calendar invites. Admin gating via the /admin layout.
 */
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LocationsManager, type LocationRow } from "@/components/admin/LocationsManager";

export const metadata: Metadata = { title: "Locations" };

export default async function LocationsAdminPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("locations")
    .select("id, name, parking_url, playing_url, is_default")
    .order("sort_order", { ascending: true });

  const rows: LocationRow[] = (data ?? []).map((r) => ({
    id: r.id as string,
    name: (r.name as string) ?? "",
    parkingUrl: (r.parking_url as string) ?? "",
    playingUrl: (r.playing_url as string) ?? "",
    isDefault: Boolean(r.is_default),
  }));

  return (
    <div>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Locations</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          Your playing venues. Each has a parking and a playing Google Maps link. Games are created against a location
          (the default for community-opened games), and match reminders + calendar invites use its links.
        </p>
      </header>
      <LocationsManager initial={rows} />
    </div>
  );
}
