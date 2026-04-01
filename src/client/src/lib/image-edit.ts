import { renderPdfToDataUrl } from "./pdf-preview";

export interface CropRotateResult {
  rotation: number;
  crop: { x: number; y: number; w: number; h: number } | null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function fileToImage(file: File): Promise<HTMLImageElement> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") {
    // Render PDF at high resolution for full-quality output
    const dataUrl = await renderPdfToDataUrl(file, 4000);
    return loadImage(dataUrl);
  }
  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.readAsDataURL(file);
  });
  return loadImage(dataUrl);
}

/**
 * Apply rotation and crop to the original file at full resolution.
 * Crop coordinates are normalized (0-1) relative to the rotated image.
 */
export async function applyEditsToFile(
  file: File,
  edits: CropRotateResult,
): Promise<File> {
  const img = await fileToImage(file);
  const { rotation, crop } = edits;

  const swapped = rotation % 180 !== 0;
  const fullW = swapped ? img.height : img.width;
  const fullH = swapped ? img.width : img.height;

  const rotCanvas = document.createElement("canvas");
  rotCanvas.width = fullW;
  rotCanvas.height = fullH;
  const rotCtx = rotCanvas.getContext("2d")!;
  rotCtx.translate(fullW / 2, fullH / 2);
  rotCtx.rotate((rotation * Math.PI) / 180);
  rotCtx.drawImage(img, -img.width / 2, -img.height / 2);

  let outputCanvas: HTMLCanvasElement;

  if (crop && crop.w > 0.01 && crop.h > 0.01) {
    const cx = Math.round(crop.x * fullW);
    const cy = Math.round(crop.y * fullH);
    const cw = Math.round(crop.w * fullW);
    const ch = Math.round(crop.h * fullH);

    outputCanvas = document.createElement("canvas");
    outputCanvas.width = cw;
    outputCanvas.height = ch;
    const outCtx = outputCanvas.getContext("2d")!;
    outCtx.drawImage(rotCanvas, cx, cy, cw, ch, 0, 0, cw, ch);
  } else {
    outputCanvas = rotCanvas;
  }

  return new Promise((resolve) => {
    outputCanvas.toBlob((blob) => {
      const name = file.name.replace(/\.[^.]+$/, ".png");
      resolve(new File([blob!], name, { type: "image/png" }));
    }, "image/png");
  });
}
