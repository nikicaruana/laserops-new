"use client";

/**
 * components/portal/AvatarUploader.tsx
 * --------------------------------------------------------------------
 * Profile-picture control. Changing the photo first asks the source:
 *   - Upload a photo    -> pick a file, position/zoom in a locked 1:1 frame, and
 *                          upload the cropped square blob to /api/profile-pic.
 *   - From tagged photos-> pick one of the photos this player is tagged in, then
 *                          position/zoom it in the SAME 1:1 frame. The crop is
 *                          applied by Cloudinary (c_crop on the source) and saved
 *                          via the sourceUrl POST - no canvas, no cross-origin.
 * If the player has no tagged photos, "Change photo" goes straight to upload.
 * Profile photos render SQUARE (circles are reserved for squad logos).
 */
import { useCallback, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { useRouter } from "next/navigation";
import { getCroppedBlob, type PixelCrop } from "@/lib/cropImage";
import { avatarOrDefault } from "@/lib/avatar";
import { Button } from "@/components/ui/Button";

/** 1:1 delivery transform – safety net on top of the client-side square crop. */
function squareUrl(url: string, w = 400): string {
  if (!url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/c_fill,ar_1:1,g_auto,w_${w},q_auto,f_auto/`);
}

/** Bake a chosen crop region (in the source image's own pixels) into a Cloudinary
 *  delivery URL, then square it to a 400x400 avatar. Cloudinary renders it; the
 *  server copies that rendered URL to the avatar. */
function croppedSquareUrl(url: string, c: PixelCrop, w = 400): string {
  if (!url.includes("/upload/")) return url;
  const crop = `c_crop,x_${Math.round(c.x)},y_${Math.round(c.y)},w_${Math.round(c.width)},h_${Math.round(c.height)}`;
  return url.replace("/upload/", `/upload/${crop}/c_fill,w_${w},h_${w},q_auto,f_auto/`);
}

type TaggedPhoto = { id: string; url: string };

export function AvatarUploader({
  initialUrl,
  opsTag,
  taggedPhotos = [],
}: {
  initialUrl: string | null;
  opsTag: string | null;
  taggedPhotos?: TaggedPhoto[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentUrl, setCurrentUrl] = useState<string | null>(initialUrl);
  const [imageSrc, setImageSrc] = useState<string | null>(null); // the image being cropped (object URL or a tagged photo URL)
  const [taggedSource, setTaggedSource] = useState<string | null>(null); // set when cropping a tagged photo (vs an uploaded file)
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState<PixelCrop | null>(null);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<null | "choose" | "tagged">(null);

  const hasTagged = taggedPhotos.length > 0;

  const onCropComplete = useCallback((_area: unknown, pixels: PixelCrop) => {
    setCroppedPixels(pixels);
  }, []);

  function startChange() {
    setError(null);
    if (hasTagged) setStep("choose");
    else fileInputRef.current?.click();
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setStep(null);
    setTaggedSource(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setImageSrc(URL.createObjectURL(file));
  }

  // Picking a tagged photo now opens the SAME position/zoom frame.
  function pickTagged(url: string) {
    setError(null);
    setStep(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setTaggedSource(url);
    setImageSrc(url);
  }

  function cancelCrop() {
    if (imageSrc && imageSrc.startsWith("blob:")) URL.revokeObjectURL(imageSrc);
    setImageSrc(null);
    setTaggedSource(null);
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
      let res: Response;
      if (taggedSource) {
        // Cloudinary applies the crop; the server copies the rendered URL.
        const sourceUrl = croppedSquareUrl(taggedSource, croppedPixels);
        res = await fetch("/api/profile-pic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceUrl }),
        });
      } else {
        const blob = await getCroppedBlob(imageSrc, croppedPixels);
        const form = new FormData();
        form.append("file", blob, "avatar.jpg");
        res = await fetch("/api/profile-pic", { method: "POST", body: form });
      }
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
      {/* Current avatar (branded default when none set) – square. */}
      <div className="relative h-32 w-32 overflow-hidden rounded-sm border border-border-strong bg-bg-overlay">
        <img
          src={squareUrl(avatarOrDefault(currentUrl), 256)}
          alt={opsTag ? `${opsTag} avatar` : "Your avatar"}
          className="h-full w-full object-cover"
        />
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
      <div className="flex items-center gap-4">
        <Button type="button" variant="secondary" size="sm" onClick={startChange}>
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

      {/* Source chooser */}
      {step === "choose" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setStep(null)}>
          <div className="w-full max-w-sm portal-card p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-accent">Change your photo</h3>
            <div className="flex flex-col gap-3">
              <Button type="button" size="sm" onClick={() => { setStep(null); fileInputRef.current?.click(); }}>
                Upload a photo
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setStep("tagged")}>
                From tagged photos
              </Button>
              <button type="button" onClick={() => setStep(null)} className="mt-1 text-xs uppercase tracking-[0.12em] text-text-subtle hover:text-accent">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tagged-photo picker */}
      {step === "tagged" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setStep(null)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto border border-border bg-bg-overlay p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-[0.12em] text-accent">Pick a tagged photo</h3>
            <p className="mb-4 text-xs text-text-muted">You&rsquo;ll position and zoom it next.</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {taggedPhotos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickTagged(p.url)}
                  className="group relative aspect-square overflow-hidden rounded-sm border border-border bg-bg transition-colors hover:border-accent"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <Button type="button" variant="secondary" size="sm" onClick={() => setStep("choose")}>
                Back
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Crop editor (shown after picking a file OR a tagged photo) */}
      {imageSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md portal-card p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-accent">Position your photo</h3>

            <div className="relative h-72 w-full overflow-hidden bg-bg">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="rect"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            <label className="mt-4 block">
              <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-text-muted">Zoom</span>
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
              <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={cancelCrop} disabled={status === "saving"}>
                Cancel
              </Button>
              <Button type="button" size="sm" className="flex-1" onClick={saveCrop} disabled={status === "saving" || !croppedPixels}>
                {status === "saving" ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
