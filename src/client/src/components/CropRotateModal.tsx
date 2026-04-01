import { useCallback, useEffect, useRef, useState } from "react";
import { renderPdfToDataUrl } from "../lib/pdf-preview";
import type { CropRotateResult } from "../lib/image-edit";

interface CropRotateModalProps {
  file: File;
  onApply: (result: CropRotateResult) => void;
  onCancel: () => void;
}

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function CropRotateModal({
  file,
  onApply,
  onCancel,
}: CropRotateModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [rotation, setRotation] = useState(0);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

  // Load image from the original file
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      let src: string;
      if (ext === "pdf") {
        src = await renderPdfToDataUrl(file, 800);
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
      }
    },
    [],
  );

  const getCanvasPoint = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pt = getCanvasPoint(e);
      dragStart.current = pt;
      setDragging(true);
      setCrop(null);
    },
    [getCanvasPoint],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!dragging || !dragStart.current) return;
      const pt = getCanvasPoint(e);
      const x = Math.min(dragStart.current.x, pt.x);
      const y = Math.min(dragStart.current.y, pt.y);
      const w = Math.abs(pt.x - dragStart.current.x);
      const h = Math.abs(pt.y - dragStart.current.y);
      setCrop({ x, y, w, h });
    },
    [dragging, getCanvasPoint],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
    dragStart.current = null;
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
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>

        <div className="crop-modal-hint">
          Click and drag on the image to select a crop area
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
