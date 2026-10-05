"use client";

/**
 * components/admin/ContentImagesManager.tsx
 * --------------------------------------------------------------------
 * Upload + manage images for the public content pages. One card per surface
 * (community, outdoor hero/arena/kit, stag). Upload posts to /api/admin/image
 * with the surface's kind (folder + tag); the content pages read those tags, so
 * uploads appear automatically. Listing/deleting existing images uses the
 * Cloudinary admin API (works on live/staging; local dev can only upload).
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type Img = { publicId: string; url: string };

export function ContentImagesManager({ surfaces }: { surfaces: { kind: string; label: string }[] }) {
  const [byKind, setByKind] = useState<Record<string, Img[]>>({});
  const [busyKind, setBusyKind] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function load(kind: string) {
    try {
      const res = await fetch(`/api/admin/content-images?kind=${encodeURIComponent(kind)}`);
      const data = (await res.json()) as { ok: boolean; images?: Img[] };
      if (data.ok && data.images) setByKind((m) => ({ ...m, [kind]: data.images! }));
    } catch {
      /* listing unavailable (e.g. local dev) - uploads still work */
    }
  }

  useEffect(() => {
    surfaces.forEach((s) => load(s.kind));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function upload(kind: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusyKind(kind);
    setError("");
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      try {
        const res = await fetch("/api/admin/image", { method: "POST", body: form });
        const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
        if (data.ok && data.url) setByKind((m) => ({ ...m, [kind]: [{ publicId: "", url: data.url! }, ...(m[kind] ?? [])] }));
        else setError(data.error || "Upload failed.");
      } catch {
        setError("Upload failed.");
      }
    }
    setBusyKind(null);
    if (inputs.current[kind]) inputs.current[kind]!.value = "";
    load(kind); // refresh to pick up the new asset's public_id
  }

  async function remove(kind: string, publicId: string) {
    if (!publicId) return;
    if (!confirm("Delete this image from Cloudinary? It will disappear from the content page.")) return;
    const prev = byKind[kind] ?? [];
    setByKind((m) => ({ ...m, [kind]: prev.filter((i) => i.publicId !== publicId) }));
    try {
      const res = await fetch("/api/admin/content-images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) { setByKind((m) => ({ ...m, [kind]: prev })); setError(data.error || "Delete failed."); }
    } catch {
      setByKind((m) => ({ ...m, [kind]: prev }));
      setError("Delete failed.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-xs font-semibold text-red-400">{error}</p>}
      {surfaces.map((s) => {
        const imgs = byKind[s.kind] ?? [];
        return (
          <section key={s.kind} className="border border-border bg-bg-elevated p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-accent">{s.label}</h2>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => load(s.kind)} className="text-[0.65rem] uppercase tracking-[0.1em] text-text-subtle hover:text-accent">Refresh</button>
                <input ref={(el) => { inputs.current[s.kind] = el; }} type="file" accept="image/*" multiple hidden onChange={(e) => upload(s.kind, e.target.files)} />
                <button
                  type="button"
                  onClick={() => inputs.current[s.kind]?.click()}
                  disabled={busyKind === s.kind}
                  className="bg-accent px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-bg transition-colors hover:bg-accent-soft disabled:opacity-60"
                >
                  {busyKind === s.kind ? "Uploading…" : "Upload"}
                </button>
              </div>
            </div>
            {imgs.length === 0 ? (
              <p className="text-xs text-text-subtle">No images yet (or listing isn&rsquo;t available on local dev).</p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {imgs.map((img, i) => (
                  <div key={img.publicId || `new-${i}`} className="group relative overflow-hidden border border-border bg-bg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={s.label} loading="lazy" className="block aspect-square w-full object-cover" />
                    {img.publicId && (
                      <button
                        type="button"
                        onClick={() => remove(s.kind, img.publicId)}
                        aria-label="Delete image"
                        className={cn("absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-bg/80 text-base leading-none text-text-muted opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100")}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
