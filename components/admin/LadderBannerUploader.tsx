"use client";

/**
 * components/admin/LadderBannerUploader.tsx
 * --------------------------------------------------------------------
 * Upload a ladder banner (sponsorship image). Recommended 1600×400 (4:1); the
 * stored image is cropped/resized per device at render via ladderBannerUrl().
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { LADDER_BANNER_W, LADDER_BANNER_H, ladderBannerUrl } from "@/lib/ladders";

export function LadderBannerUploader({ ladderId, initialUrl }: { ladderId: string; initialUrl: string | null }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("ladder_id", ladderId);
      const res = await fetch("/api/admin/ladder-banner", { method: "POST", body: form });
      const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
      if (!res.ok || !data.ok || !data.url) throw new Error(data.error || "Upload failed.");
      setUrl(data.url);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      {url && (
        <div className="mb-3 aspect-[4/1] w-full overflow-hidden border border-border bg-bg-overlay">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ladderBannerUrl(url, 900)} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
      <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
        {busy ? "Uploading…" : url ? "Change banner" : "Upload banner"}
      </Button>
      <p className="mt-1.5 text-[0.65rem] text-text-subtle">
        Recommended {LADDER_BANNER_W}×{LADDER_BANNER_H} (4:1). Cropped and resized automatically for each device.
      </p>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
