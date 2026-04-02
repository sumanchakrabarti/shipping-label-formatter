import { useEffect, useMemo, useState } from "react";
import { getPdfPageCount, renderPdfToDataUrl } from "../lib/pdf-preview";

interface PdfPageSelectorProps {
  file: File | null;
  selectedPages: number[];
  onChange: (pages: number[]) => void;
}

interface PageThumb {
  pageNum: number;
  dataUrl: string;
}

export default function PdfPageSelector({ file, selectedPages, onChange }: PdfPageSelectorProps) {
  const [thumbnails, setThumbnails] = useState<PageThumb[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const selectedSet = useMemo(() => new Set(selectedPages), [selectedPages]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!file) {
        setThumbnails([]);
        setPageCount(0);
        return;
      }

      setLoading(true);
      setThumbnails([]);

      try {
        const count = await getPdfPageCount(file);
        if (cancelled) return;

        setPageCount(count);
        setCurrentPage(1);

        const nextThumbs: PageThumb[] = [];
        for (let pageNum = 1; pageNum <= count; pageNum++) {
          const dataUrl = await renderPdfToDataUrl(file, { pageNum, maxDim: 220 });
          if (cancelled) return;
          nextThumbs.push({ pageNum, dataUrl });
          setThumbnails([...nextThumbs]);
        }
      } catch {
        if (!cancelled) {
          setThumbnails([]);
          setPageCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [file]);

  const togglePage = (pageNum: number) => {
    const next = new Set(selectedSet);
    if (next.has(pageNum)) {
      next.delete(pageNum);
    } else {
      next.add(pageNum);
    }
    onChange([...next].sort((a, b) => a - b));
  };

  const selectAll = () => {
    onChange(Array.from({ length: pageCount }, (_, i) => i + 1));
  };

  const clearAll = () => {
    onChange([]);
  };

  const goPrev = () => {
    setCurrentPage((p) => Math.max(1, p - 1));
  };

  const goNext = () => {
    setCurrentPage((p) => Math.min(pageCount, p + 1));
  };

  const isCurrentSelected = selectedSet.has(currentPage);
  const currentThumb = thumbnails.find((t) => t.pageNum === currentPage);

  if (!file) return null;

  return (
    <div className="pdf-page-selector">
      <div className="pdf-page-selector-header">
        <strong>Page Preview</strong>
        <span>{selectedPages.length} selected</span>
      </div>

      <div className="pdf-page-selector-actions">
        <button type="button" className="btn-sm" onClick={selectAll} disabled={!pageCount}>
          Select all
        </button>
        <button type="button" className="btn-sm" onClick={clearAll} disabled={!selectedPages.length}>
          Clear
        </button>
      </div>

      <div className="pdf-focused-preview">
        <button
          type="button"
          className="page-btn"
          onClick={goPrev}
          disabled={currentPage <= 1}
          title="Previous page"
        >
          ◀
        </button>

        <div className="pdf-focused-preview-body">
          {currentThumb ? (
            <img src={currentThumb.dataUrl} alt={`Focused preview page ${currentPage}`} />
          ) : (
            <div className="pdf-file-meta">Loading page {currentPage}...</div>
          )}
          <div className="pdf-focused-preview-meta">
            <span className="page-counter">
              {currentPage} / {pageCount || 1}
            </span>
            <button
              type="button"
              className={`btn-sm ${isCurrentSelected ? "pdf-selected-toggle" : ""}`}
              onClick={() => togglePage(currentPage)}
              disabled={!pageCount}
            >
              {isCurrentSelected ? "Selected" : "Select this page"}
            </button>
          </div>
        </div>

        <button
          type="button"
          className="page-btn"
          onClick={goNext}
          disabled={currentPage >= pageCount}
          title="Next page"
        >
          ▶
        </button>
      </div>

      {loading && <div className="pdf-file-meta">Loading page thumbnails...</div>}

      <div className="pdf-page-grid">
        {thumbnails.map((thumb) => {
          const isSelected = selectedSet.has(thumb.pageNum);
          return (
            <button
              key={thumb.pageNum}
              type="button"
              className={`pdf-page-card ${isSelected ? "selected" : ""}`}
              onClick={() => togglePage(thumb.pageNum)}
            >
              <img src={thumb.dataUrl} alt={`Page ${thumb.pageNum}`} />
              <span className="pdf-page-card-label">Page {thumb.pageNum}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
