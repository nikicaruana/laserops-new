"use client";

/**
 * components/admin/GunImageUploader.tsx
 * --------------------------------------------------------------------
 * Image control for the gun editor. Shows the current image and lets an
 * admin upload a new one to Cloudinary (via /api/admin/gun-image, which is
 * admin-gated and server-signs the upload). The returned URL is handed back
 * via onChange; the parent form persists it to guns.image_url on save.
 */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

export function GunImageUploader({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/gun-image", { method: "POST", body: form });
      const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
      if (!res.ok || !data.ok || !data.url) throw new Error(data.error || "Upload failed.");
      onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-28 shrink-0 items-center justify-center border border-border-strong bg-bg">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[0.6rem] uppercase tracking-wide text-text-subtle">
              No image
            </span>
          )}
        </div>
        <div className="flex flex-col items-start gap-2">
          <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            {busy ? "Uploading…" : value ? "Change image" : "Upload image"}
          </Button>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-xs uppercase tracking-[0.12em] text-text-subtle hover:text-accent"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
