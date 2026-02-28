import { useEffect, useRef } from "react";
import { renderPdfPageToCanvas } from "../lib/pdf-preview";

interface OutputPreviewProps {
  blobUrl: string;
}

export default function OutputPreview({ blobUrl }: OutputPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    (async () => {
      const resp = await fetch(blobUrl);
      const buf = await resp.arrayBuffer();
      const canvas = await renderPdfPageToCanvas(buf, 520);
      if (!cancelled && container) {
        container.innerHTML = "";
        container.appendChild(canvas);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blobUrl]);

  return (
    <div className="output-section visible">
      <div className="output-label">Output Preview</div>
      <div className="output-preview" ref={containerRef} />
    </div>
  );
}
