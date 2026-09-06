"use client";

/**
 * components/match-report/PhotoStoryComposer.tsx
 * --------------------------------------------------------------------
 * Turns a match photo into a 1080x1920 story. Stage 1: position the photo in
 * the 9:16 frame (Fit / Fill / drag + zoom) and pick a stats overlay. Stage 2:
 * the real server-rendered result, with Share (native sheet on mobile) or
 * Download. Placement is computed in 1080x1920 space and sent to the story
 * route, so the output matches the preview exactly.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { cldImage } from "@/lib/cld";
import { Modal } from "@/components/ui/Modal";
import { PHOTO_OVERLAYS, type PhotoOverlay, type OverlayData } from "@/lib/story/meta";
import { canShareFile, downloadFile, fetchStoryFile, shareFile } from "@/lib/story/share";
import { cn } from "@/lib/cn";

const FW = 1080;
const FH = 1920;
const FRAME_W = 288; // on-screen preview width
const FRAME_H = (FRAME_W * FH) / FW;
const S = FRAME_W / FW; // screen px per frame px

type Mode = "fit" | "fill";

function baseSize(natW: number, natH: number, mode: Mode) {
  const fAR = FW / FH;
  const pAR = natW / natH;
  if (mode === "fill") {
    return pAR > fAR ? { w: FH * pAR, h: FH } : { w: FW, h: FW / pAR };
  }
  return pAR > fAR ? { w: FW, h: FW / pAR } : { w: FH * pAR, h: FH };
}

/** Live, readable representation of the overlay band shown in the crop frame so
 *  you can see what's baked on and position the photo around it. The exact,
 *  full-scale version comes from the server on "Preview result". */
function CropBand({ overlay, data }: { overlay: PhotoOverlay; data: OverlayData }) {
  if (overlay === "none" || !data) return null;
  const Stat = ({ s }: { s: OverlayData["stats"][number] }) => (
    <div className="flex flex-col items-center">
      <span className="text-[17px] font-extrabold leading-none text-white">{s.value}</span>
      <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wide text-white/70">{s.label}</span>
      {s.rank > 0 && <span className={cn("text-[8px] font-bold uppercase", s.rank <= 2 ? "text-accent" : "text-white/50")}>#{s.rank}</span>}
    </div>
  );
  // eslint-disable-next-line @next/next/no-img-element
  const Badge = ({ b }: { b: OverlayData["accolades"][number] }) => (
    <div className="relative flex">
      <img src={cldImage(b.badgeUrl, { w: 384 })} alt={b.name} className="h-14 w-14 object-contain" />
      {typeof b.count === "number" && b.count > 1 && (
        <span className="absolute -right-1 -top-1 rounded-full border border-black bg-accent px-1 text-[8px] font-extrabold text-black">×{b.count}</span>
      )}
    </div>
  );
  const name = <div className="mb-2 text-center text-[18px] font-extrabold leading-none text-accent">{data.nickname}</div>;

  let body: React.ReactNode = null;
  if (overlay === "main" || overlay === "highlights") {
    const items = overlay === "main" ? data.stats.slice(0, 4) : [...data.stats].sort((a, b) => a.rank - b.rank).slice(0, 4);
    body = (
      <>
        {name}
        <div className="flex justify-between">{items.map((s, i) => <Stat key={i} s={s} />)}</div>
      </>
    );
  } else if (overlay === "captures") {
    body = (
      <>
        {name}
        <div className="flex justify-around">{data.captureStats.map((s, i) => <Stat key={i} s={s} />)}</div>
      </>
    );
  } else if (overlay === "result") {
    body = (
      <div className="flex flex-col items-center">
        <span className="text-[18px] font-extrabold" style={{ color: data.result.won ? "#ffde00" : "#dc2626" }}>{data.result.won ? "VICTORY" : "DEFEAT"}</span>
        <span className="text-[11px] font-extrabold text-white">
          <span style={{ color: "#ef4444" }}>RED {data.result.redRounds}</span> - <span style={{ color: "#3b82f6" }}>{data.result.blueRounds} BLUE</span>
        </span>
      </div>
    );
  } else if (overlay === "accolade") {
    body = (
      <div className="flex flex-col items-center">
        <span className="mb-1.5 text-[8px] font-extrabold uppercase tracking-widest text-accent">Accolades</span>
        {data.accolades.length > 0 ? (
          <div className="flex items-center justify-center gap-2">{data.accolades.slice(0, 5).map((b, i) => <Badge key={i} b={b} />)}</div>
        ) : (
          <span className="text-[10px] font-bold text-white/70">No accolades this match</span>
        )}
      </div>
    );
  } else if (overlay === "streaks") {
    body = (
      <div className="flex flex-col items-center">
        <span className="mb-1.5 text-[8px] font-extrabold uppercase tracking-widest text-accent">Streaks</span>
        {data.streaks.length > 0 ? (
          <div className="flex items-center justify-center gap-2">{data.streaks.slice(0, 5).map((b, i) => <Badge key={i} b={b} />)}</div>
        ) : (
          <span className="text-[10px] font-bold text-white/70">No streaks this match</span>
        )}
      </div>
    );
  } else {
    // identity - centered: ops tag, level badge, level text
    body = (
      <div className="flex flex-col items-center">
        <span className="text-[20px] font-extrabold text-accent">{data.nickname}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {data.rankBadgeUrl && <img src={cldImage(data.rankBadgeUrl, { w: 384 })} alt="" className="mt-1 h-11 w-11 object-contain" />}
        <span className="mt-0.5 text-[10px] font-bold text-white/70">Lvl {data.level}</span>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/80 to-transparent px-3 pb-14 pt-10">
      {body}
      <div className="mt-2 text-center text-[9px] font-extrabold uppercase tracking-widest text-accent">laseropsmalta.com</div>
    </div>
  );
}

export function PhotoStoryComposer({ matchId, ops, photoUrl, overlayData, onClose }: { matchId: string; ops: string; photoUrl: string; overlayData?: OverlayData; onClose: () => void }) {
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [mode, setMode] = useState<Mode>("fill");
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // in frame px
  const [overlay, setOverlay] = useState<PhotoOverlay>("main");
  const branding = true; // branding is always on
  const [stage, setStage] = useState<"edit" | "result">("edit");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const drag = useRef<{ x: number; y: number } | null>(null);

  const placement = useMemo(() => {
    if (!nat) return { w: FW, h: FH, left: 0, top: 0 };
    const b = baseSize(nat.w, nat.h, mode);
    const w = b.w * scale;
    const h = b.h * scale;
    return { w, h, left: (FW - w) / 2 + offset.x, top: (FH - h) / 2 + offset.y };
  }, [nat, mode, scale, offset]);

  function preset(m: Mode) {
    setMode(m);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dx = (e.clientX - drag.current.x) / S;
    const dy = (e.clientY - drag.current.y) / S;
    drag.current = { x: e.clientX, y: e.clientY };
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  }
  function onPointerUp() {
    drag.current = null;
  }

  const storyUrl = useMemo(() => {
    const p = new URLSearchParams({
      t: "photo",
      photo: photoUrl,
      iw: String(Math.round(placement.w)),
      ih: String(Math.round(placement.h)),
      il: String(Math.round(placement.left)),
      it: String(Math.round(placement.top)),
      ov: overlay,
      brand: branding ? "1" : "0",
    });
    return `/api/story/${encodeURIComponent(matchId)}/${encodeURIComponent(ops)}?${p.toString()}`;
  }, [matchId, ops, photoUrl, placement, overlay, branding]);

  const fileName = `laserops-${ops}-photo.png`.replace(/[^a-z0-9.\-]/gi, "-");

  async function act(share: boolean) {
    setBusy(true);
    setStatus("");
    try {
      const file = await fetchStoryFile(storyUrl, fileName);
      if (share && canShareFile(file)) {
        await shareFile(file);
        setStatus("Shared.");
      } else {
        downloadFile(file);
        setStatus(share ? "Saved to your device." : "Downloaded.");
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") setStatus("Something went wrong. Try Download.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Share photo to story" onClose={onClose} maxWidth="max-w-md">
      {stage === "edit" ? (
        <div className="flex flex-col gap-4">
          {/* Crop frame */}
          <div className="flex justify-center">
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="relative touch-none overflow-hidden rounded-sm border border-border-strong bg-black"
              style={{ width: FRAME_W, height: FRAME_H, cursor: "grab" }}
            >
              {/* Blurred cover fill so Fit-mode bars show the image, not black. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt=""
                draggable={false}
                aria-hidden
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(16px) brightness(0.6)", transform: "scale(1.1)" }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt="Photo"
                draggable={false}
                onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth || FW, h: e.currentTarget.naturalHeight || FH })}
                style={{
                  position: "absolute",
                  left: placement.left * S,
                  top: placement.top * S,
                  width: placement.w * S,
                  height: placement.h * S,
                  maxWidth: "none",
                  objectFit: "cover",
                  userSelect: "none",
                }}
              />
              {/* live overlay band (readable representation of the baked result) */}
              {overlayData && overlay !== "none" && <CropBand overlay={overlay} data={overlayData} />}
              {branding && (
                <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center bg-gradient-to-b from-black/90 via-black/70 to-transparent px-3 pb-24 pt-9">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brand/laserops-logo-yellow.png" alt="LaserOps" className="h-6 w-auto object-contain" />
                  {overlayData?.matchDate && <span className="mt-1 text-[8px] font-bold uppercase tracking-[0.2em] text-white/80">{overlayData.matchDate}</span>}
                </div>
              )}
            </div>
          </div>

          {/* Fit / Fill + zoom */}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => preset("fit")} className={cn("flex-1 rounded-sm border px-3 py-2 text-xs font-bold uppercase tracking-[0.1em]", mode === "fit" ? "border-accent bg-accent/10 text-accent" : "border-border text-text")}>Fit</button>
            <button type="button" onClick={() => preset("fill")} className={cn("flex-1 rounded-sm border px-3 py-2 text-xs font-bold uppercase tracking-[0.1em]", mode === "fill" ? "border-accent bg-accent/10 text-accent" : "border-border text-text")}>Fill</button>
          </div>
          <label className="flex items-center gap-3 text-[0.65rem] uppercase tracking-[0.12em] text-text-muted">
            Zoom
            <input type="range" min={1} max={3} step={0.01} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="flex-1 accent-accent" />
          </label>
          <p className="text-center text-[0.65rem] text-text-subtle">Drag the photo to reposition.</p>

          {/* Overlay preset */}
          <div>
            <p className="mb-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-text-muted">Stats overlay</p>
            <div className="grid grid-cols-2 gap-2">
              {PHOTO_OVERLAYS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setOverlay(o.key)}
                  className={cn("flex flex-col items-start rounded-sm border px-2.5 py-1.5 text-left", overlay === o.key ? "border-accent bg-accent/10" : "border-border")}
                >
                  <span className={cn("text-[0.7rem] font-bold uppercase tracking-[0.08em]", overlay === o.key ? "text-accent" : "text-text")}>{o.label}</span>
                  <span className="text-[0.6rem] leading-tight text-text-muted">{o.blurb}</span>
                </button>
              ))}
            </div>
          </div>

          <button type="button" onClick={() => setStage("result")} disabled={!nat} className="rounded-sm bg-accent px-4 py-2.5 text-sm font-bold uppercase tracking-[0.12em] text-bg transition-colors hover:bg-accent-soft disabled:opacity-60">
            Preview result
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={storyUrl} src={storyUrl} alt="Story preview" className="max-h-[56vh] w-auto rounded-sm border border-border-strong" style={{ aspectRatio: "9 / 16" }} />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => act(true)} disabled={busy} className="flex flex-1 items-center justify-center rounded-sm bg-accent px-4 py-2.5 text-sm font-bold uppercase tracking-[0.12em] text-bg transition-colors hover:bg-accent-soft disabled:opacity-60">
              {busy ? "Working…" : "Share"}
            </button>
            <button type="button" onClick={() => act(false)} disabled={busy} className="flex flex-1 items-center justify-center rounded-sm border border-border-strong px-4 py-2.5 text-sm font-bold uppercase tracking-[0.12em] text-text hover:border-accent hover:text-accent disabled:opacity-60">
              Download
            </button>
          </div>
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setStage("edit")} className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
              ‹ Edit
            </button>
            <p className="text-[0.7rem] text-text-muted">{status || "On mobile, Share opens Instagram Stories."}</p>
          </div>
        </div>
      )}
    </Modal>
  );
}
