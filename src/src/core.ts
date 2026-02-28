/**
 * Core image processing and PDF generation logic.
 *
 * Node.js port of shipping_label_py/label_resize_print/core.py
 * Uses: sharp (images), mupdf (PDF rasterization), pdf-lib (PDF creation)
 */

import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FitMode = "fit" | "fill" | "stretch";

export interface ResizeLabelOptions {
  inputPath: string;
  outputPath?: string;
  inputPath2?: string;
  dpi?: number;
  fitMode?: FitMode;
  autoCrop?: boolean;
  labelSize?: string;
}

export interface ResizeLabelFromBuffersOptions {
  buffer1: Buffer;
  ext1: string;
  buffer2?: Buffer;
  ext2?: string;
  dpi?: number;
  fitMode?: FitMode;
  autoCrop?: boolean;
  labelSize?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const LABEL_SIZES: Record<string, [number, number]> = {
  "4x6": [4, 6],
  "4x8": [4, 8],
  "2x7": [2, 7],
  letter: [8.5, 11],
};

export const DEFAULT_LABEL_SIZE = "4x6";
export const DEFAULT_DPI = 300;

export const SUPPORTED_IMAGE_EXTS: ReadonlySet<string> = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".bmp",
  ".tiff",
  ".tif",
  ".webp",
]);
export const SUPPORTED_PDF_EXTS: ReadonlySet<string> = new Set([".pdf"]);
export const SUPPORTED_EXTS: ReadonlySet<string> = new Set([
  ...SUPPORTED_IMAGE_EXTS,
  ...SUPPORTED_PDF_EXTS,
]);

// Landscape US letter page dimensions (inches)
const PAGE_WIDTH_IN = 11.0;
const PAGE_HEIGHT_IN = 8.5;
const PTS_PER_INCH = 72;

// ---------------------------------------------------------------------------
// Image loading
// ---------------------------------------------------------------------------

/**
 * Load an image file (or PDF page) and return a PNG buffer.
 */
export async function loadImage(inputPath: string): Promise<Buffer> {
  const ext = path.extname(inputPath).toLowerCase();

  if (SUPPORTED_IMAGE_EXTS.has(ext)) {
    return sharp(inputPath).png().toBuffer();
  }
  if (SUPPORTED_PDF_EXTS.has(ext)) {
    return loadImageFromPdf(inputPath);
  }
  throw new Error(
    `Unsupported file format '${ext}'. Supported: ${[...SUPPORTED_EXTS].sort().join(", ")}`,
  );
}

/**
 * Rasterise a PDF page to a PNG buffer using MuPDF (WASM).
 */
export async function loadImageFromPdf(
  pdfPath: string,
  pageNum: number = 0,
  dpi: number = DEFAULT_DPI,
): Promise<Buffer> {
  // Dynamic import so the app still works for image-only use without mupdf
  let mupdf: typeof import("mupdf");
  try {
    mupdf = await import("mupdf");
  } catch {
    throw new Error(
      "The 'mupdf' package is required for PDF input. Run: npm install mupdf",
    );
  }

  const fileData = fs.readFileSync(pdfPath);
  const doc = mupdf.Document.openDocument(fileData, "application/pdf");
  const pageCount = doc.countPages();

  if (pageNum >= pageCount) {
    throw new Error(
      `Page ${pageNum} does not exist. PDF has ${pageCount} page(s).`,
    );
  }

  const page = doc.loadPage(pageNum);
  const zoom = dpi / 72;
  const pixmap = page.toPixmap(
    mupdf.Matrix.scale(zoom, zoom),
    mupdf.ColorSpace.DeviceRGB,
  );
  const pngBuf = pixmap.asPNG();
  return Buffer.from(pngBuf);
}

// ---------------------------------------------------------------------------
// Auto-crop
// ---------------------------------------------------------------------------

/**
 * Detect and crop to the shipping label's black border rectangle.
 *
 * Algorithm (mirrors Python implementation):
 *  1. Convert to grayscale, find bounding box of all dark pixels
 *  2. Scan inward from each edge past solid border lines
 *  3. Expand outward by 8 px so some border remains visible
 */
export async function autoCropLabel(
  imageBuffer: Buffer,
  borderThreshold: number = 80,
  minAreaRatio: number = 0.05,
): Promise<Buffer> {
  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width!;
  const height = meta.height!;

  // Get single-channel grayscale raw data
  const { data: gray } = await sharp(imageBuffer)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // --- Find bounding box of all dark pixels ---
  let bx0 = width;
  let by0 = height;
  let bx1 = 0;
  let by1 = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    const rowOff = y * width;
    for (let x = 0; x < width; x++) {
      if (gray[rowOff + x] < borderThreshold) {
        found = true;
        if (x < bx0) bx0 = x;
        if (y < by0) by0 = y;
        if (x + 1 > bx1) bx1 = x + 1;
        if (y + 1 > by1) by1 = y + 1;
      }
    }
  }

  if (!found) return imageBuffer;

  const boxW = bx1 - bx0;
  const boxH = by1 - by0;
  if (boxW * boxH < width * height * minAreaRatio) return imageBuffer;

  // --- Helpers: check if a row/column is mostly dark (border line) ---
  function rowIsBorder(ry: number, x0: number, x1: number): boolean {
    let dark = 0;
    const len = x1 - x0;
    const off = ry * width;
    for (let x = x0; x < x1; x++) {
      if (gray[off + x] < borderThreshold) dark++;
    }
    return dark > len * 0.5;
  }

  function colIsBorder(cx: number, y0: number, y1: number): boolean {
    let dark = 0;
    const len = y1 - y0;
    for (let y = y0; y < y1; y++) {
      if (gray[y * width + cx] < borderThreshold) dark++;
    }
    return dark > len * 0.5;
  }

  // --- Scan inward past border lines ---
  let top = by0;
  const scanH = Math.min(Math.floor(boxH / 2), 100);
  for (let y = by0; y < by0 + scanH; y++) {
    if (!rowIsBorder(y, bx0, bx1)) {
      top = y;
      break;
    }
  }

  let bottom = by1;
  for (let y = by1 - 1; y > by1 - scanH; y--) {
    if (!rowIsBorder(y, bx0, bx1)) {
      bottom = y + 1;
      break;
    }
  }

  const scanW = Math.min(Math.floor(boxW / 2), 100);
  let left = bx0;
  for (let x = bx0; x < bx0 + scanW; x++) {
    if (!colIsBorder(x, by0, by1)) {
      left = x;
      break;
    }
  }

  let right = bx1;
  for (let x = bx1 - 1; x > bx1 - scanW; x--) {
    if (!colIsBorder(x, by0, by1)) {
      right = x + 1;
      break;
    }
  }

  // --- Expand outward by 8 px so border remains visible ---
  const pad = 8;
  left = Math.max(left - pad, 0);
  top = Math.max(top - pad, 0);
  right = Math.min(right + pad, width);
  bottom = Math.min(bottom + pad, height);

  return sharp(imageBuffer)
    .extract({
      left,
      top,
      width: right - left,
      height: bottom - top,
    })
    .png()
    .toBuffer();
}

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------

/**
 * Resize an image buffer to target label dimensions.
 */
export async function resizeImage(
  imageBuffer: Buffer,
  labelSize: [number, number],
  dpi: number = DEFAULT_DPI,
  fitMode: FitMode = "fit",
): Promise<Buffer> {
  const targetW = Math.round(labelSize[0] * dpi);
  const targetH = Math.round(labelSize[1] * dpi);
  const whiteBg = { r: 255, g: 255, b: 255 } as const;

  if (fitMode === "stretch") {
    return sharp(imageBuffer)
      .resize(targetW, targetH, { fit: "fill" }) // sharp "fill" = stretch
      .flatten({ background: whiteBg })
      .png()
      .toBuffer();
  }

  if (fitMode === "fill") {
    return sharp(imageBuffer)
      .resize(targetW, targetH, { fit: "cover", position: "centre" })
      .flatten({ background: whiteBg })
      .png()
      .toBuffer();
  }

  // Default: "fit" — contain within bounds, white background
  return sharp(imageBuffer)
    .resize(targetW, targetH, {
      fit: "contain",
      background: whiteBg,
    })
    .flatten({ background: whiteBg })
    .png()
    .toBuffer();
}

// ---------------------------------------------------------------------------
// PDF output (2-up landscape letter)
// ---------------------------------------------------------------------------

/** Embed images into a landscape-letter PDF page, returning the PDF bytes. */
async function buildPdf2Up(
  images: Buffer[],
  labelSize: [number, number] = [4, 6],
): Promise<Uint8Array> {
  const pageW = PAGE_WIDTH_IN * PTS_PER_INCH; // 792
  const pageH = PAGE_HEIGHT_IN * PTS_PER_INCH; // 612
  const labelW = labelSize[0] * PTS_PER_INCH;
  const labelH = labelSize[1] * PTS_PER_INCH;
  const halfW = pageW / 2;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([pageW, pageH]);

  for (let i = 0; i < Math.min(images.length, 2); i++) {
    const img = await pdfDoc.embedPng(images[i]);
    const x =
      i === 0
        ? (halfW - labelW) / 2
        : halfW + (halfW - labelW) / 2;
    const y = (pageH - labelH) / 2;
    page.drawImage(img, { x, y, width: labelW, height: labelH });
  }

  return pdfDoc.save();
}

/**
 * Create a landscape letter PDF with 1 or 2 labels side by side and write to
 * disk.
 */
export async function savePdf2Up(
  images: Buffer[],
  outputPath: string,
  labelSize: [number, number] = [4, 6],
): Promise<void> {
  const pdfBytes = await buildPdf2Up(images, labelSize);
  fs.writeFileSync(outputPath, pdfBytes);
}

// ---------------------------------------------------------------------------
// High-level entry points
// ---------------------------------------------------------------------------

/** Load, auto-crop, and resize a single label. */
async function prepareLabel(
  inputPath: string,
  dpi: number = DEFAULT_DPI,
  fitMode: FitMode = "fit",
  autoCrop: boolean = true,
  labelSize: [number, number] = [4, 6],
): Promise<Buffer> {
  let buf = await loadImage(inputPath);
  if (autoCrop) {
    buf = await autoCropLabel(buf);
  }
  return resizeImage(buf, labelSize, dpi, fitMode);
}

/**
 * Process one or two labels from file paths, output a 2-up PDF.
 *
 * @returns path to the generated PDF
 */
export async function resizeLabel({
  inputPath,
  outputPath,
  inputPath2,
  dpi = DEFAULT_DPI,
  fitMode = "fit",
  autoCrop = true,
  labelSize: labelSizeKey = DEFAULT_LABEL_SIZE,
}: ResizeLabelOptions): Promise<string> {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }
  if (inputPath2 && !fs.existsSync(inputPath2)) {
    throw new Error(`Second input file not found: ${inputPath2}`);
  }

  const size = LABEL_SIZES[labelSizeKey] ?? LABEL_SIZES[DEFAULT_LABEL_SIZE];

  if (!outputPath) {
    const base = inputPath.replace(/\.[^.]+$/, "");
    outputPath = `${base}_label.pdf`;
  }

  const labels: Buffer[] = [
    await prepareLabel(inputPath, dpi, fitMode, autoCrop, size),
  ];
  if (inputPath2) {
    labels.push(await prepareLabel(inputPath2, dpi, fitMode, autoCrop, size));
  }

  await savePdf2Up(labels, outputPath, size);
  return outputPath;
}

/**
 * Process label(s) from in-memory buffers (used by the web server).
 *
 * @returns PDF buffer
 */
export async function resizeLabelFromBuffers({
  buffer1,
  ext1,
  buffer2,
  ext2,
  dpi = DEFAULT_DPI,
  fitMode = "fit",
  autoCrop = true,
  labelSize: labelSizeKey = DEFAULT_LABEL_SIZE,
}: ResizeLabelFromBuffersOptions): Promise<Buffer> {
  const size = LABEL_SIZES[labelSizeKey] ?? LABEL_SIZES[DEFAULT_LABEL_SIZE];

  async function bufToImage(buf: Buffer, ext: string): Promise<Buffer> {
    if (SUPPORTED_PDF_EXTS.has(ext)) {
      const tmp = path.join(os.tmpdir(), `label_${Date.now()}${ext}`);
      fs.writeFileSync(tmp, buf);
      try {
        return await loadImageFromPdf(tmp, 0, dpi);
      } finally {
        fs.unlinkSync(tmp);
      }
    }
    return sharp(buf).png().toBuffer();
  }

  async function prepare(buf: Buffer, ext: string): Promise<Buffer> {
    let img = await bufToImage(buf, ext);
    if (autoCrop) img = await autoCropLabel(img);
    return resizeImage(img, size, dpi, fitMode);
  }

  const labels: Buffer[] = [await prepare(buffer1, ext1)];
  if (buffer2 && ext2) {
    labels.push(await prepare(buffer2, ext2));
  }

  const pdfBytes = await buildPdf2Up(labels, size);
  return Buffer.from(pdfBytes);
}
