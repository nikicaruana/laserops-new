"use client";

/**
 * components/admin/WeaponMasteryManager.tsx
 * --------------------------------------------------------------------
 * Admin editor for Weapon Mastery. One card per gun: toggle whether mastery is
 * live, and upload/replace the Bronze/Silver/Gold/Platinum badge art. Writes the
 * weapon_mastery row via the admin session (admin-write RLS), 2FA-gated. The
 * mastery REQUIREMENTS are not edited here - they follow the streak/accolade
 * tiers (edit those under Streaks / Accolades).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { AdminImageUploader } from "@/components/admin/AdminImageUploader";
import { TotpGate } from "@/components/admin/TotpGate";

export type MasteryItem = {
  gunName: string;
  id: string | null;
  enabled: boolean;
  sortOrder: number | null;
  bronze: string | null;
  silver: string | null;
  gold: string | null;
  platinum: string | null;
};

const LEVELS = [
  ["bronze", "Bronze"],
  ["silver", "Silver"],
  ["gold", "Gold"],
  ["platinum", "Platinum"],
] as const;

export function WeaponMasteryManager({ items }: { items: MasteryItem[] }) {
  const router = useRouter();
  const [list, setList] = useState<MasteryItem[]>(items);
  const [savingGun, setSavingGun] = useState<string | null>(null);
  const [savedGun, setSavedGun] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null); // gun name awaiting 2FA

  function patch(gunName: string, p: Partial<MasteryItem>) {
    setList((prev) => prev.map((it) => (it.gunName === gunName ? { ...it, ...p } : it)));
    setSavedGun(null);
  }

  async function doSave(gunName: string) {
    setPending(null);
    const item = list.find((i) => i.gunName === gunName);
    if (!item) return;
    setSavingGun(gunName);
    setError(null);
    const supabase = createClient();
    const payload = {
      enabled: item.enabled,
      bronze_badge_url: item.bronze || null,
      silver_badge_url: item.silver || null,
      gold_badge_url: item.gold || null,
      platinum_badge_url: item.platinum || null,
    };
    if (item.id) {
      const { error: err } = await supabase.from("weapon_mastery").update(payload).eq("id", item.id);
      setSavingGun(null);
      if (err) { setError(`${gunName}: ${err.message}`); return; }
    } else {
      const { data, error: err } = await supabase
        .from("weapon_mastery")
        .insert({ gun_name: item.gunName, ...payload })
        .select("id")
        .single();
      setSavingGun(null);
      if (err || !data) { setError(`${gunName}: ${err?.message || "Couldn't save."}`); return; }
      patch(gunName, { id: data.id });
    }
    setSavedGun(gunName);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>
      )}
      <p className="max-w-2xl text-sm text-text-muted">
        Toggle mastery per gun and set its badge art. The requirements come from the
        streak &amp; accolade tiers: Bronze needs every tier-1 streak with the gun, Silver
        tier-2, Gold tier-3 plus the Specialist &amp; Eagle Eye accolades, Platinum tier-4 plus every tier-3
        accolade. Guns left off show &ldquo;Mastery coming soon&rdquo;.
      </p>

      {list.map((item) => (
        <fieldset key={item.gunName} className="border border-border bg-bg-elevated px-5 py-4">
          <legend className="flex items-center gap-3 px-2">
            <span className="text-sm font-bold uppercase tracking-[0.12em] text-accent">{item.gunName}</span>
          </legend>

          <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-text-muted">
            <input
              type="checkbox"
              className="h-4 w-4 accent-accent"
              checked={item.enabled}
              onChange={(e) => patch(item.gunName, { enabled: e.target.checked })}
            />
            Mastery live for this gun
          </label>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LEVELS.map(([key, label]) => (
              <div key={key}>
                <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</p>
                <AdminImageUploader
                  value={item[key]}
                  onChange={(url) => patch(item.gunName, { [key]: url } as Partial<MasteryItem>)}
                  kind="mastery"
                  previewClass="h-20 w-20"
                  expandable
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-4">
            <Button
              type="button"
              size="sm"
              disabled={savingGun === item.gunName}
              onClick={() => setPending(item.gunName)}
            >
              {savingGun === item.gunName ? "Saving…" : "Save"}
            </Button>
            {savedGun === item.gunName && <span className="text-sm text-accent">Saved.</span>}
          </div>
        </fieldset>
      ))}

      <TotpGate
        open={pending !== null}
        action={pending ? `mastery for ${pending}` : "this change"}
        onCancel={() => setPending(null)}
        onVerified={() => { if (pending) doSave(pending); }}
      />
    </div>
  );
}
