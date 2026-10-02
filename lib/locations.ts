/**
 * lib/locations.ts
 * --------------------------------------------------------------------
 * Venues / playing locations (locations table). Each has a parking + playing
 * Google Maps link and one is the default. Read via the cookieless public client
 * so marketing / portal pages stay static / ISR. Games reference a location;
 * match reminders + calendar invites use its links (falling back to the default).
 * Never throws – returns [] / null on failure.
 */
import { createPublicClient } from "@/lib/supabase/public";

export type Location = {
  id: string;
  name: string;
  parkingUrl: string;
  playingUrl: string;
  isDefault: boolean;
  sortOrder: number;
};

type Row = {
  id: string;
  name: string | null;
  parking_url: string | null;
  playing_url: string | null;
  is_default: boolean | null;
  sort_order: number | null;
};

function toLocation(r: Row): Location {
  return {
    id: r.id,
    name: (r.name ?? "").trim(),
    parkingUrl: (r.parking_url ?? "").trim(),
    playingUrl: (r.playing_url ?? "").trim(),
    isDefault: Boolean(r.is_default),
    sortOrder: Number(r.sort_order) || 0,
  };
}

export async function getLocations(): Promise<Location[]> {
  try {
    const sb = createPublicClient();
    const { data } = await sb
      .from("locations")
      .select("id, name, parking_url, playing_url, is_default, sort_order")
      .order("sort_order", { ascending: true });
    return (data ?? []).map((r) => toLocation(r as Row));
  } catch {
    return [];
  }
}

export async function getDefaultLocation(): Promise<Location | null> {
  const all = await getLocations();
  return all.find((l) => l.isDefault) ?? all[0] ?? null;
}

/**
 * The location to use for a match: its own location if set, else the default.
 * `locationId` may be null/undefined (e.g. legacy games) -> default.
 */
export async function resolveMatchLocation(locationId: string | null | undefined): Promise<Location | null> {
  const all = await getLocations();
  if (locationId) {
    const own = all.find((l) => l.id === locationId);
    if (own) return own;
  }
  return all.find((l) => l.isDefault) ?? all[0] ?? null;
}
