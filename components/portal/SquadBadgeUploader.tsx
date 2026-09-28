"use client";

/**
 * components/portal/SquadBadgeUploader.tsx
 * --------------------------------------------------------------------
 * Square badge picker for a squad, with a round crop. Two modes:
 *   - squadId set   -> uploads immediately to /api/squad-badge (manage page).
 *   - onChange set   -> hands the cropped blob to the parent (create form), which
 *     uploads it after the squad exists.
 * Falls back to the squad's initials when no badge is set.
 */
import { useCallback, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { useRouter } from "next/navigation";
import { getCroppedBlob, type PixelCrop } from "@/lib/cropImage";
import { Button } from "@/components/ui/Button";

export function SquadBadgeUploader({
  squadId,
  initialUrl = null,
  name,
  onChange,
}: {
  squadId?: string;
  initialUrl?: string | null;
  name: string;
  onChange?: (blob: Blob | null) => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(initialUrl);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState<PixelCrop | null>(null);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_a: unknown, pixels: PixelCrop) => setCroppedPixels(pixels), []);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Please choose an image file.");
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setImageSrc(URL.createObjectURL(file));
  }

  function cancelCrop() {
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc(null);
    setCroppedPixels(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function saveCrop() {
    if (!imageSrc || !croppedPixels) return;
    setStatus("saving");
    setError(null);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedPixels);
      if (squadId) {
        const form = new FormData();
        form.append("file", blob, "badge.jpg");
        form.append("squad_id", squadId);
        const res = await fetch("/api/squad-badge", { method: "POST", body: form });
        const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
        if (!res.ok || !data.ok || !data.url) throw new Error(data.error || "Upload failed.");
        setCurrentUrl(data.url);
        router.refresh();
      } else {
        // Deferred: preview locally + hand the blob to the parent.
        setPreviewUrl(URL.createObjectURL(blob));
        onChange?.(blob);
      }
      cancelCrop();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setStatus("idle");
    }
  }

  const shown = previewUrl || currentUrl;

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-strong bg-bg-overlay text-lg font-bold text-text-muted">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className="h-full w-full object-cover" />
        ) : (
          name.slice(0, 2).toUpperCase() || "SQ"
        )}
      </div>
      <div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
        <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
          {shown ? "Change badge" : "Add badge"}
        </Button>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>

      {imageSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md portal-card p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-accent">Position the badge</h3>
            <div className="relative h-72 w-full overflow-hidden bg-bg">
              <Cropper image={imageSrc} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
            </div>
            <label className="mt-4 block">
              <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-text-muted">Zoom</span>
              <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-accent" />
            </label>
            <div className="mt-5 flex gap-3">
              <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={cancelCrop} disabled={status === "saving"}>
                Cancel
              </Button>
              <Button type="button" size="sm" className="flex-1" onClick={saveCrop} disabled={status === "saving"}>
                {status === "saving" ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
