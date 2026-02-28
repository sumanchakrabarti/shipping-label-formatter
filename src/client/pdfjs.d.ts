/**
 * Type declarations for the PDF.js subset used by this app.
 * Loaded at runtime from CDN as an ES module.
 */

declare module "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.min.mjs" {
  export interface PDFPageViewport {
    width: number;
    height: number;
  }

  export interface RenderTask {
    promise: Promise<void>;
  }

  export interface PDFPageProxy {
    getViewport(params: { scale: number }): PDFPageViewport;
    render(params: {
      canvasContext: CanvasRenderingContext2D;
      viewport: PDFPageViewport;
    }): RenderTask;
  }

  export interface PDFDocumentProxy {
    getPage(pageNumber: number): Promise<PDFPageProxy>;
  }

  export interface PDFDocumentLoadingTask {
    promise: Promise<PDFDocumentProxy>;
  }

  export const GlobalWorkerOptions: { workerSrc: string };
  export function getDocument(params: { data: ArrayBuffer }): PDFDocumentLoadingTask;
}
