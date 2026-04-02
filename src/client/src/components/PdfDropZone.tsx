import { useCallback, useRef, useState } from "react";

interface PdfDropZoneProps {
  label: string;
  files: File[];
  multiple?: boolean;
  onFilesChange: (files: File[]) => void;
  onClear: () => void;
}

export default function PdfDropZone({
  label,
  files,
  multiple = false,
  onFilesChange,
  onClear,
}: PdfDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const hasFiles = files.length > 0;

  const commitFiles = useCallback(
    (incoming: FileList | File[]) => {
      const all = Array.from(incoming).filter(
        (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
      );
      if (!all.length) return;
      onFilesChange(multiple ? all : [all[0]]);
    },
    [multiple, onFilesChange],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length) {
        commitFiles(e.dataTransfer.files);
      }
    },
    [commitFiles],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        commitFiles(e.target.files);
      }
    },
    [commitFiles],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      onClear();
    },
    [onClear],
  );

  const className = ["drop-zone", isDragOver && "dragover", hasFiles && "has-file"]
    .filter(Boolean)
    .join(" ");

  const summaryText = hasFiles
    ? files.length === 1
      ? files[0].name
      : `${files.length} PDF files selected`
    : "";

  return (
    <div
      className={className}
      onClick={() => inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {hasFiles && (
        <button
          type="button"
          className="clear-btn"
          title="Remove files"
          onClick={handleClear}
        >
          ✕
        </button>
      )}
      <div className="drop-zone-label">{label}</div>
      <div className="drop-zone-icon">📄</div>
      <div className="drop-zone-text">
        <strong>Tap</strong> or drop PDF
      </div>
      {summaryText && <div className="file-name">{summaryText}</div>}
      <input
        ref={inputRef}
        type="file"
        className="file-input"
        accept=".pdf,application/pdf"
        multiple={multiple}
        onChange={handleChange}
      />
    </div>
  );
}
