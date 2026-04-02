/**
 * Express web application for label resizing.
 */

import express, { type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { PDFDocument } from "pdf-lib";
import {
  SUPPORTED_EXTS,
  DEFAULT_DPI,
  resizeLabelFromBuffers,
} from "./core.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// In dev, __dirname is src/src/; in production, __dirname is dist/.
// Resolve the project root so asset paths work in both modes.
const isDev = path.basename(__dirname) === "src";
const rootDir = isDev ? path.resolve(__dirname, "..") : __dirname;

const app = express();

// 50 MB upload limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Serve static assets (sw.js, icons)
app.use("/static", express.static(path.join(rootDir, "public")));

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

app.get("/manifest.json", (_req: Request, res: Response) => {
  res.json({
    name: "Label Resize & Print",
    short_name: "LabelPrint",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    icons: [
      { src: "/static/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/static/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  });
});

const uploadFields = upload.fields([
  { name: "file", maxCount: 1 },
  { name: "file2", maxCount: 1 },
]);
const uploadPdfFiles = upload.array("files", 20);

function parsePageSelection(input: string, pageCount: number): number[] {
  if (!input.trim()) {
    return Array.from({ length: pageCount }, (_, i) => i);
  }

  const selected: number[] = [];
  const chunks = input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    const range = chunk.split("-").map((s) => s.trim());
    if (range.length === 1) {
      const p = parseInt(range[0], 10);
      if (!Number.isFinite(p) || p < 1 || p > pageCount) {
        throw new Error(`Invalid page '${chunk}'. Use values between 1 and ${pageCount}.`);
      }
      selected.push(p - 1);
      continue;
    }

    if (range.length === 2) {
      const start = parseInt(range[0], 10);
      const end = parseInt(range[1], 10);
      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start < 1 ||
        end < 1 ||
        start > end ||
        end > pageCount
      ) {
        throw new Error(`Invalid range '${chunk}'. Use ranges like 2-5 within 1-${pageCount}.`);
      }
      for (let p = start; p <= end; p++) {
        selected.push(p - 1);
      }
      continue;
    }

    throw new Error(`Invalid page expression '${chunk}'.`);
  }

  const unique = [...new Set(selected)];
  if (!unique.length) {
    throw new Error("No pages selected.");
  }
  return unique;
}

app.post("/resize", uploadFields, async (req: Request, res: Response) => {
  try {
    const files = req.files as
      | Record<string, Express.Multer.File[]>
      | undefined;

    if (!files?.file?.[0]) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const file1 = files.file[0];
    const ext1 = path.extname(file1.originalname).toLowerCase();
    if (!SUPPORTED_EXTS.has(ext1)) {
      res.status(400).json({
        error: `Unsupported format '${ext1}'. Supported: ${[...SUPPORTED_EXTS].sort().join(", ")}`,
      });
      return;
    }

    const dpi = parseInt((req.body.dpi as string) ?? String(DEFAULT_DPI), 10);
    const fitMode = (req.body.fit as string) ?? "fit";
    const autoCrop =
      ((req.body.auto_crop as string) ?? "true").toLowerCase() === "true";
    const labelSize = (req.body.label_size as string) ?? "4x6";
    const pageNum1 = parseInt((req.body.page as string) ?? "1", 10);
    let pageNum2: number | undefined;
    const pageParam2 = req.body.page2 as string | undefined;
    if (pageParam2) {
      pageNum2 = parseInt(pageParam2, 10);
    }

    let buffer2: Buffer | undefined;
    let ext2: string | undefined;
    const file2 = files.file2?.[0];
    if (file2?.originalname) {
      ext2 = path.extname(file2.originalname).toLowerCase();
      if (SUPPORTED_EXTS.has(ext2)) {
        buffer2 = file2.buffer;
      }
    }

    const pdfBuffer = await resizeLabelFromBuffers({
      buffer1: file1.buffer,
      ext1,
      buffer2,
      ext2,
      dpi,
      fitMode: fitMode as "fit" | "fill" | "stretch",
      autoCrop,
      labelSize,
      pageNum1,
      pageNum2,
    });

    const baseName = file1.originalname.replace(/\.[^.]+$/, "");
    res
      .set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}_label.pdf"`,
      })
      .send(pdfBuffer);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Processing failed";
    console.error("Processing error:", err);
    const status =
      message.includes("not found") || message.includes("Unsupported")
        ? 400
        : 500;
    res.status(status).json({ error: message });
  }
});

app.post("/pdf/modify", uploadPdfFiles, async (req: Request, res: Response) => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) {
      res.status(400).json({ error: "No PDF files uploaded" });
      return;
    }

    const action = ((req.body.action as string) ?? "merge").toLowerCase();
    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext !== ".pdf") {
        res.status(400).json({ error: `Only PDF files are supported for this tool. Invalid: ${file.originalname}` });
        return;
      }
    }

    const outDoc = await PDFDocument.create();

    if (action === "merge") {
      for (const file of files) {
        const src = await PDFDocument.load(file.buffer);
        const pages = await outDoc.copyPages(src, src.getPageIndices());
        for (const page of pages) {
          outDoc.addPage(page);
        }
      }
    } else if (action === "select") {
      const src = await PDFDocument.load(files[0].buffer);
      const pagesExpr = (req.body.pages as string) ?? "";
      const indices = parsePageSelection(pagesExpr, src.getPageCount());
      const pages = await outDoc.copyPages(src, indices);
      for (const page of pages) {
        outDoc.addPage(page);
      }
    } else {
      res.status(400).json({ error: `Unsupported action '${action}'.` });
      return;
    }

    const bytes = await outDoc.save();
    const fileName = action === "merge" ? "merged.pdf" : "selected_pages.pdf";
    res
      .set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      })
      .send(Buffer.from(bytes));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "PDF modification failed";
    console.error("PDF modify error:", err);
    res.status(400).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// Serve React build (production) or fallback HTML (dev without Vite)
// ---------------------------------------------------------------------------

const clientDist = isDev
  ? path.join(rootDir, "dist", "client")
  : path.join(rootDir, "client");

if (fs.existsSync(path.join(clientDist, "index.html"))) {
  app.use(express.static(clientDist));
  app.get("*", (_req: Request, res: Response) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`🚀 Label Resize & Print running at http://localhost:${PORT}`);
});

export default app;
