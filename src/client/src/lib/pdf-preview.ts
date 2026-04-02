import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface RenderPdfToDataUrlOptions {
  pageNum?: number;
  maxDim?: number;
}

interface RenderPdfPageToCanvasOptions {
  pageNum?: number;
  maxWidth?: number;
}

/** Get total page count of a PDF File. */
export async function getPdfPageCount(file: File): Promise<number> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  return pdf.numPages;
}

/** Render a specific page of a PDF File to a data URL for thumbnail previews. */
export async function renderPdfToDataUrl(
  file: File,
  { pageNum = 1, maxDim = 300 }: RenderPdfToDataUrlOptions = {},
): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(Math.max(1, Math.min(pageNum, pdf.numPages)));
  const vp = page.getViewport({ scale: 1 });
  const scale = Math.min(maxDim / vp.width, maxDim / vp.height, 2);
  const scaled = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = scaled.width;
  canvas.height = scaled.height;
  await page.render({
    canvasContext: canvas.getContext("2d")!,
    viewport: scaled,
  }).promise;
  return canvas.toDataURL("image/png");
}

/** Render a specific page of a PDF ArrayBuffer to an HTMLCanvasElement. */
export async function renderPdfPageToCanvas(
  data: ArrayBuffer,
  { pageNum = 1, maxWidth = 520 }: RenderPdfPageToCanvasOptions = {},
): Promise<HTMLCanvasElement> {
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(Math.max(1, Math.min(pageNum, pdf.numPages)));
  const vp = page.getViewport({ scale: 1 });
  const scale = Math.min(maxWidth / vp.width, 2);
  const scaled = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = scaled.width;
  canvas.height = scaled.height;
  await page.render({
    canvasContext: canvas.getContext("2d")!,
    viewport: scaled,
  }).promise;
  return canvas;
}
