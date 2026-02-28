/**
 * Express web application for label resizing.
 *
 * Node.js port of shipping_label_py/label_resize_print/app.py
 */

import express, { type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import {
  SUPPORTED_EXTS,
  DEFAULT_DPI,
  resizeLabelFromBuffers,
} from "./core.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// 50 MB upload limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Serve static assets (sw.js, icons, manifest)
app.use("/static", express.static(path.join(__dirname, "..", "public")));
app.use("/public", express.static(path.join(__dirname, "..", "public")));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get("/", (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "..", "views", "index.html"));
});

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

// Multer populates req.files as Record<string, Express.Multer.File[]>
const uploadFields = upload.fields([
  { name: "file", maxCount: 1 },
  { name: "file2", maxCount: 1 },
]);

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

    // Optional second file
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

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`🚀 Label Resize & Print running at http://localhost:${PORT}`);
});

export default app;
