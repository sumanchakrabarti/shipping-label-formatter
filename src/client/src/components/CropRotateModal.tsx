import { useCallback, useEffect, useRef, useState } from "react";
import { renderPdfToDataUrl } from "../lib/pdf-preview";
import type { CropRotateResult } from "../lib/image-edit";

interface CropRotateModalProps {
  file: File;
  aspectRatio?: number;
  onApply: (result: CropRotateResult) => void;
  onCancel: () => void;
}

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type ResizeHandle = "nw" | "ne" | "sw" | "se";

interface InteractionState {
  mode: "create" | "move" | "resize";
  start: { x: number; y: number };
  startCrop: CropRect | null;
  handle?: ResizeHandle;
}

const MIN_CROP_SIZE = 12;
const HANDLE_RADIUS = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeRect(rect: CropRect): CropRect {
  const x2 = rect.x + rect.w;
  const y2 = rect.y + rect.h;
  return {
    x: Math.min(rect.x, x2),
    y: Math.min(rect.y, y2),
    w: Math.abs(rect.w),
    h: Math.abs(rect.h),
  };
}

function findResizeHandle(pt: { x: number; y: number }, rect: CropRect): ResizeHandle | null {
  const corners: Array<{ name: ResizeHandle; x: number; y: number }> = [
    { name: "nw", x: rect.x, y: rect.y },
    { name: "ne", x: rect.x + rect.w, y: rect.y },
    { name: "sw", x: rect.x, y: rect.y + rect.h },
    { name: "se", x: rect.x + rect.w, y: rect.y + rect.h },
  ];

  for (const corner of corners) {
    const dx = pt.x - corner.x;
    const dy = pt.y - corner.y;
    if (Math.hypot(dx, dy) <= HANDLE_RADIUS) {
      return corner.name;
    }
  }

  return null;
}

function isInsideRect(pt: { x: number; y: number }, rect: CropRect): boolean {
  return (
    pt.x >= rect.x &&
    pt.x <= rect.x + rect.w &&
    pt.y >= rect.y &&
    pt.y <= rect.y + rect.h
  );
}

function rectFromAnchor(
  anchor: { x: number; y: number },
  pt: { x: number; y: number },
  bounds: { w: number; h: number },
  aspectRatio: number | null,
  minSize = 0,
): CropRect {
  const clampedX = clamp(pt.x, 0, bounds.w);
  const clampedY = clamp(pt.y, 0, bounds.h);
  const dx = clampedX - anchor.x;
  const dy = clampedY - anchor.y;
  const sx = dx >= 0 ? 1 : -1;
  const sy = dy >= 0 ? 1 : -1;

  const maxW = sx > 0 ? bounds.w - anchor.x : anchor.x;
  const maxH = sy > 0 ? bounds.h - anchor.y : anchor.y;

  if (!aspectRatio || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    const w = clamp(Math.abs(dx), minSize, maxW);
    const h = clamp(Math.abs(dy), minSize, maxH);
    const x = sx > 0 ? anchor.x : anchor.x - w;
    const y = sy > 0 ? anchor.y : anchor.y - h;
    return normalizeRect({ x, y, w, h });
  }

  const ratio = aspectRatio;
  const rawW = Math.abs(dx);
  const rawH = Math.abs(dy);

  const minWFromHeight = minSize * ratio;
  const minW = Math.max(minSize, minWFromHeight);
  const maxAllowedW = Math.min(maxW, maxH * ratio);

  let desiredW = rawW;
  if (rawH > 0 && rawW / rawH < ratio) {
    desiredW = rawH * ratio;
  }

  const w = clamp(desiredW, minW, Math.max(minW, maxAllowedW));
  const h = w / ratio;
  const x = sx > 0 ? anchor.x : anchor.x - w;
  const y = sy > 0 ? anchor.y : anchor.y - h;

  return normalizeRect({ x, y, w, h });
}

export default function CropRotateModal({
  file,
  aspectRatio,
  onApply,
  onCancel,
}: CropRotateModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [rotation, setRotation] = useState(0);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [dragging, setDragging] = useState(false);
  const interactionRef = useRef<InteractionState | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

  // Load image from the original file
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      let src: string;
      if (ext === "pdf") {
        src = await renderPdfToDataUrl(file, { maxDim: 800 });
      } else {
        src = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
      }
      if (cancelled) return;
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        imgRef.current = img;
        setCrop(null);
        setRotation(0);
        drawCanvas(img, 0, null);
      };
      img.src = src;
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Redraw when rotation or crop changes
  useEffect(() => {
    if (imgRef.current) drawCanvas(imgRef.current, rotation, crop);
  }, [rotation, crop]);

  const drawCanvas = useCallback(
    (img: HTMLImageElement, rot: number, cropRect: CropRect | null) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d")!;

      const swapped = rot % 180 !== 0;
      const dw = swapped ? img.height : img.width;
      const dh = swapped ? img.width : img.height;

      // Scale to fit within the modal (max 500px)
      const maxDim = 500;
      const scale = Math.min(maxDim / dw, maxDim / dh, 1);
      const cw = Math.round(dw * scale);
      const ch = Math.round(dh * scale);

      canvas.width = cw;
      canvas.height = ch;
      setCanvasSize({ w: cw, h: ch });

      ctx.clearRect(0, 0, cw, ch);
      ctx.save();
      ctx.translate(cw / 2, ch / 2);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.drawImage(
        img,
        -img.width * scale / 2,
        -img.height * scale / 2,
        img.width * scale,
        img.height * scale,
      );
      ctx.restore();

      // Draw crop overlay
      if (cropRect) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
        // Top
        ctx.fillRect(0, 0, cw, cropRect.y);
        // Bottom
        ctx.fillRect(0, cropRect.y + cropRect.h, cw, ch - cropRect.y - cropRect.h);
        // Left
        ctx.fillRect(0, cropRect.y, cropRect.x, cropRect.h);
        // Right
        ctx.fillRect(
          cropRect.x + cropRect.w,
          cropRect.y,
          cw - cropRect.x - cropRect.w,
          cropRect.h,
        );
        // Crop border
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
        ctx.setLineDash([]);

        const corners = [
          { x: cropRect.x, y: cropRect.y },
          { x: cropRect.x + cropRect.w, y: cropRect.y },
          { x: cropRect.x, y: cropRect.y + cropRect.h },
          { x: cropRect.x + cropRect.w, y: cropRect.y + cropRect.h },
        ];

        for (const corner of corners) {
          ctx.beginPath();
          ctx.fillStyle = "#fff";
          ctx.strokeStyle = "#2563eb";
          ctx.lineWidth = 2;
          ctx.arc(corner.x, corner.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
    },
    [],
  );

  const getCanvasPoint = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const pt = getCanvasPoint(e);
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (crop) {
        const handle = findResizeHandle(pt, crop);
        if (handle) {
          interactionRef.current = {
            mode: "resize",
            start: pt,
            startCrop: crop,
            handle,
          };
        } else if (isInsideRect(pt, crop)) {
          interactionRef.current = {
            mode: "move",
            start: pt,
            startCrop: crop,
          };
        } else {
          interactionRef.current = {
            mode: "create",
            start: pt,
            startCrop: null,
          };
          setCrop({ x: pt.x, y: pt.y, w: 0, h: 0 });
        }
      } else {
        interactionRef.current = {
          mode: "create",
          start: pt,
          startCrop: null,
        };
        setCrop({ x: pt.x, y: pt.y, w: 0, h: 0 });
      }

      canvas.setPointerCapture(e.pointerId);
      setDragging(true);
    },
    [getCanvasPoint, crop],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!dragging || !interactionRef.current) return;

      e.preventDefault();
      const pt = getCanvasPoint(e);

      const interaction = interactionRef.current;

      const constrainedRatio = aspectRatio ?? null;

      if (interaction.mode === "create") {
        setCrop(rectFromAnchor(interaction.start, pt, canvasSize, constrainedRatio));
        return;
      }

      if (!interaction.startCrop) return;

      if (interaction.mode === "move") {
        const dx = pt.x - interaction.start.x;
        const dy = pt.y - interaction.start.y;
        const nextX = clamp(interaction.startCrop.x + dx, 0, canvasSize.w - interaction.startCrop.w);
        const nextY = clamp(interaction.startCrop.y + dy, 0, canvasSize.h - interaction.startCrop.h);
        setCrop({
          x: nextX,
          y: nextY,
          w: interaction.startCrop.w,
          h: interaction.startCrop.h,
        });
        return;
      }

      if (interaction.mode === "resize" && interaction.handle) {
        const left = interaction.startCrop.x;
        const top = interaction.startCrop.y;
        const right = interaction.startCrop.x + interaction.startCrop.w;
        const bottom = interaction.startCrop.y + interaction.startCrop.h;

        const anchorByHandle: Record<ResizeHandle, { x: number; y: number }> = {
          nw: { x: right, y: bottom },
          ne: { x: left, y: bottom },
          sw: { x: right, y: top },
          se: { x: left, y: top },
        };

        const anchor = anchorByHandle[interaction.handle];
        setCrop(rectFromAnchor(anchor, pt, canvasSize, constrainedRatio, MIN_CROP_SIZE));
      }
    },
    [dragging, getCanvasPoint, canvasSize, aspectRatio],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
        canvasRef.current.releasePointerCapture(e.pointerId);
      }
      interactionRef.current = null;
      setDragging(false);
    },
    [],
  );

  const handlePointerCancel = useCallback(() => {
    interactionRef.current = null;
    setDragging(false);
  }, []);

  const handleRotate = useCallback(
    (dir: number) => {
      setRotation((r) => (r + dir + 360) % 360);
      setCrop(null);
    },
    [],
  );

  const handleClearCrop = useCallback(() => setCrop(null), []);

  const handleApply = useCallback(() => {
    // Return normalized crop coordinates and rotation — the actual
    // full-resolution rasterization happens in the caller via applyEditsToFile.
    let normalizedCrop: CropRotateResult["crop"] = null;
    if (crop && crop.w > 5 && crop.h > 5 && canvasSize.w > 0 && canvasSize.h > 0) {
      normalizedCrop = {
        x: crop.x / canvasSize.w,
        y: crop.y / canvasSize.h,
        w: crop.w / canvasSize.w,
        h: crop.h / canvasSize.h,
      };
    }

    onApply({ rotation, crop: normalizedCrop });
  }, [rotation, crop, canvasSize, onApply]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  return (
    <div className="crop-modal-overlay" onClick={onCancel}>
      <div className="crop-modal" onClick={(e) => e.stopPropagation()}>
        <div className="crop-modal-header">
          <span>Crop &amp; Rotate</span>
          <button className="crop-modal-close" onClick={onCancel}>
            ✕
          </button>
        </div>

        <div className="crop-modal-canvas-wrap">
          <canvas
            ref={canvasRef}
            className="crop-modal-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={handlePointerCancel}
          />
        </div>

        <div className="crop-modal-hint">
          Drag to create a crop. Drag corner handles to resize, or drag inside to move.
          {aspectRatio ? " Crop ratio is locked to the selected label size." : ""}
        </div>

        <div className="crop-modal-toolbar">
          <button
            className="btn btn-sm"
            onClick={() => handleRotate(-90)}
            title="Rotate left 90°"
          >
            ↺ Rotate Left
          </button>
          <button
            className="btn btn-sm"
            onClick={() => handleRotate(90)}
            title="Rotate right 90°"
          >
            ↻ Rotate Right
          </button>
          {crop && (
            <button className="btn btn-sm" onClick={handleClearCrop}>
              Clear Crop
            </button>
          )}
        </div>

        <div className="crop-modal-actions">
          <button className="btn btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleApply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
