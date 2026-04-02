import { useEffect, useRef, useState } from "react";
import { getPdfPageCountFromData, renderPdfPageToCanvas } from "../lib/pdf-preview";

interface OutputPreviewProps {
  blobUrl: string;
}

export default function OutputPreview({ blobUrl }: OutputPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const resp = await fetch(blobUrl);
        const buf = await resp.arrayBuffer();
        const count = await getPdfPageCountFromData(buf);
        if (!cancelled) {
          setPreviewError(null);
          setPdfData(buf);
          setPageCount(Math.max(1, count));
          setCurrentPage(1);
        }
      } catch {
        if (!cancelled) {
          setPdfData(null);
          setPageCount(1);
          setCurrentPage(1);
          setPreviewError("Unable to render PDF preview.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blobUrl]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !pdfData) return;

    let cancelled = false;

    (async () => {
      try {
        const canvas = await renderPdfPageToCanvas(pdfData, {
          pageNum: currentPage,
          maxWidth: 520,
        });
        if (!cancelled) {
          setPreviewError(null);
          container.innerHTML = "";
          container.appendChild(canvas);
        }
      } catch {
        if (!cancelled) {
          setPreviewError("Unable to render PDF page.");
          container.innerHTML = "";
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfData, currentPage]);

  const goPrev = () => {
    setCurrentPage((p) => Math.max(1, p - 1));
  };

  const goNext = () => {
    setCurrentPage((p) => Math.min(pageCount, p + 1));
  };

  return (
    <div className="output-section visible">
      <div className="output-label">Output Preview</div>
      <div className="output-preview" ref={containerRef} />
      {previewError && <div className="pdf-file-meta output-preview-error">{previewError}</div>}
      {pageCount > 1 && (
        <div className="output-preview-nav">
          <button
            type="button"
            className="page-btn"
            onClick={goPrev}
            disabled={currentPage <= 1}
            title="Previous output page"
          >
            ◀
          </button>
          <span className="page-counter">
            {currentPage} / {pageCount}
          </span>
          <button
            type="button"
            className="page-btn"
            onClick={goNext}
            disabled={currentPage >= pageCount}
            title="Next output page"
          >
            ▶
          </button>
        </div>
      )}
    </div>
  );
}
