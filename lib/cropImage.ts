/**
 * lib/cropImage.ts
 * --------------------------------------------------------------------
 * Turns a react-easy-crop selection into a square image Blob, rendered
 * client-side on a canvas. Output is capped at 800x800 (avatars never
 * need more) and encoded as JPEG to keep uploads small.
 */

export type PixelCrop = { x: number; y: number; width: number; height: number };

const MAX_SIZE = 800;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (e) => reject(e));
    img.src = src;
  });
}

/**
 * @param imageSrc  object URL of the source image
 * @param crop      pixel crop region from react-easy-crop (already square)
 * @returns         a square JPEG Blob ready to upload
 */
export async function getCroppedBlob(
  imageSrc: string,
  crop: PixelCrop,
): Promise<Blob> {
  const image = await loadImage(imageSrc);

  // Cap output resolution while preserving the 1:1 crop.
  const size = Math.min(Math.round(crop.width), MAX_SIZE);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    size,
    size,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas is empty"))),
      "image/jpeg",
      0.9,
    );
  });
}
