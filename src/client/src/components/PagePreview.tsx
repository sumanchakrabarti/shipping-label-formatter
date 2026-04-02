import { useEffect, useState } from "react";
import { renderPdfToDataUrl, getPdfPageCount } from "../lib/pdf-preview";

interface PagePreviewProps {
  file1: File | null;
  file2: File | null;
  labelSize: string;
  selectedPage1?: number;
  selectedPage2?: number;
  onSelectedPageChange?: (slot: 1 | 2, pageNum: number) => void;
  onEditImage?: (slot: 1 | 2) => void;
}

function PreviewSlot({
  file,
  labelSize,
  placeholder,
  selectedPage,
  onPageChange,
  onEdit,
}: {
  file: File | null;
  labelSize: string;
  placeholder: string;
  selectedPage?: number;
  onPageChange?: (pageNum: number) => void;
  onEdit?: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(selectedPage ?? 1);
  const [w, h] = labelSize.split("x").map(Number);

  useEffect(() => {
    setCurrentPage(selectedPage ?? 1);
  }, [selectedPage]);

  useEffect(() => {
    let cancelled = false;

    if (!file) {
      setPreview(null);
      setPageCount(0);
      return () => {
        cancelled = true;
      };
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "pdf") {
      setPreview(null);
      getPdfPageCount(file)
        .then((count) => {
          if (cancelled) return null;
          setPageCount(count);
          const nextPage = Math.min(Math.max(currentPage, 1), count);
          if (nextPage !== currentPage) {
            setCurrentPage(nextPage);
            onPageChange?.(nextPage);
          }
          return renderPdfToDataUrl(file, {
            pageNum: nextPage,
            maxDim: 900,
          });
        })
        .then((dataUrl) => {
          if (!cancelled && dataUrl) setPreview(dataUrl);
        })
        .catch(() => {
          if (cancelled) return;
          setPreview(null);
          setPageCount(0);
        });
    } else {
      setPageCount(0);
      const reader = new FileReader();
      reader.onload = (e) => {
        if (!cancelled) setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }

    return () => {
      cancelled = true;
    };
  }, [file, currentPage, onPageChange]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    onPageChange?.(newPage);
  };

  const handleNextPage = () => {
    if (currentPage < pageCount) {
      handlePageChange(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  };

  const handleClick = () => {
    if (preview && onEdit) onEdit();
  };

  return (
    <div className="preview-slot-container">
      <div
        className={`slot ${file ? "filled" : ""} ${preview ? "editable" : ""}`}
        style={{ aspectRatio: `${w} / ${h}` }}
        onClick={handleClick}
        title={preview ? "Click to crop / rotate" : undefined}
      >
        {preview ? (
          <>
            <img src={preview} alt="preview" />
            <div className="slot-edit-badge">✂ Edit</div>
          </>
        ) : (
          placeholder
        )}
      </div>
      {pageCount > 1 && (
        <div className="page-navigation">
          <button
            className="page-btn"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            title="Previous page"
          >
            ◀
          </button>
          <span className="page-counter">
            {currentPage} / {pageCount}
          </span>
          <button
            className="page-btn"
            onClick={handleNextPage}
            disabled={currentPage >= pageCount}
            title="Next page"
          >
            ▶
          </button>
        </div>
      )}
    </div>
  );
}

export default function PagePreview({
  file1,
  file2,
  labelSize,
  selectedPage1,
  selectedPage2,
  onSelectedPageChange,
  onEditImage,
}: PagePreviewProps) {
  return (
    <div className="page-preview">
      <PreviewSlot
        file={file1}
        labelSize={labelSize}
        placeholder="Left"
        selectedPage={selectedPage1}
        onPageChange={(page) => onSelectedPageChange?.(1, page)}
        onEdit={onEditImage ? () => onEditImage(1) : undefined}
      />
      <PreviewSlot
        file={file2}
        labelSize={labelSize}
        placeholder="Right"
        selectedPage={selectedPage2}
        onPageChange={(page) => onSelectedPageChange?.(2, page)}
        onEdit={onEditImage ? () => onEditImage(2) : undefined}
      />
    </div>
  );
}
