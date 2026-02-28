import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/** Render page 1 of a PDF File to a data URL for thumbnail previews. */
export async function renderPdfToDataUrl(
  file: File,
  maxDim = 300,
): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
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

/** Render page 1 of a PDF ArrayBuffer to an HTMLCanvasElement. */
export async function renderPdfPageToCanvas(
  data: ArrayBuffer,
  maxWidth = 520,
): Promise<HTMLCanvasElement> {
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(1);
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
