"use client";

/**
 * components/portal/AvatarUploader.tsx
 * --------------------------------------------------------------------
 * Profile-picture control. Shows the current avatar and lets the player
 * pick a new image, position/zoom it inside a locked 1:1 frame (so the
 * result is always square, cropping non-square sources), then uploads the
 * cropped blob to /api/profile-pic (which stores it on Cloudinary and
 * writes the URL to their account).
 */
import { useCallback, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { useRouter } from "next/navigation";
import { getCroppedBlob, type PixelCrop } from "@/lib/cropImage";
import { Button } from "@/components/ui/Button";

/** 1:1 delivery transform — safety net on top of the client-side square crop. */
function squareUrl(url: string, w = 400): string {
  if (!url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/c_fill,ar_1:1,g_auto,w_${w},q_auto,f_auto/`);
}

export function AvatarUploader({
  initialUrl,
  opsTag,
}: {
  initialUrl: string | null;
  opsTag: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentUrl, setCurrentUrl] = useState<string | null>(initialUrl);
  const [imageSrc, setImageSrc] = useState<string | null>(null); // object URL being cropped
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState<PixelCrop | null>(null);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_area: unknown, pixels: PixelCrop) => {
    setCroppedPixels(pixels);
  }, []);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    // Reset crop state and open the editor.
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

  async function removePhoto() {
    setError(null);
    setStatus("saving");
    try {
      const res = await fetch("/api/profile-pic", { method: "DELETE" });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Couldn't remove photo.");
      setCurrentUrl(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove photo.");
    } finally {
      setStatus("idle");
    }
  }

  async function saveCrop() {
    if (!imageSrc || !croppedPixels) return;
    setStatus("saving");
    setError(null);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedPixels);
      const form = new FormData();
      form.append("file", blob, "avatar.jpg");

      const res = await fetch("/api/profile-pic", { method: "POST", body: form });
      const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
      if (!res.ok || !data.ok || !data.url) {
        throw new Error(data.error || "Upload failed.");
      }

      setCurrentUrl(data.url);
      cancelCrop();
      router.refresh(); // update the badge / server-rendered avatar
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Current avatar */}
      <div className="relative h-32 w-32 overflow-hidden rounded-full border border-border-strong bg-bg-overlay">
        {currentUrl ? (
          <img
            src={squareUrl(currentUrl, 256)}
            alt={opsTag ? `${opsTag} avatar` : "Your avatar"}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl font-bold uppercase text-text-subtle">
            {opsTag?.charAt(0) ?? "?"}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onPickFile}
        className="hidden"
      />
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          {currentUrl ? "Change photo" : "Add photo"}
        </Button>
        {currentUrl && (
          <button
            type="button"
            onClick={removePhoto}
            disabled={status === "saving"}
            className="text-xs uppercase tracking-[0.12em] text-text-subtle hover:text-accent disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Crop editor (shown after picking a file) */}
      {imageSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md border border-border-strong bg-bg-elevated p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-accent">
              Position your photo
            </h3>

            <div className="relative h-72 w-full overflow-hidden bg-bg">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            <label className="mt-4 block">
              <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-text-muted">
                Zoom
              </span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-accent"
              />
            </label>

            <div className="mt-5 flex gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={cancelCrop}
                disabled={status === "saving"}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="flex-1"
                onClick={saveCrop}
                disabled={status === "saving"}
              >
                {status === "saving" ? "Uploading…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
