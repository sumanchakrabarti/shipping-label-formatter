import { useCallback, useRef, useState } from "react";

interface DropZoneProps {
  label: string;
  file: File | null;
  onFile: (file: File) => void;
  onClear: () => void;
}

export default function DropZone({ label, file, onFile, onClear }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length) onFile(e.dataTransfer.files[0]);
    },
    [onFile],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) onFile(e.target.files[0]);
    },
    [onFile],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (inputRef.current) inputRef.current.value = "";
      onClear();
    },
    [onClear],
  );

  const className = [
    "drop-zone",
    isDragOver && "dragover",
    file && "has-file",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      onClick={() => inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {file && (
        <button
          type="button"
          className="clear-btn"
          title="Remove file"
          onClick={handleClear}
        >
          ✕
        </button>
      )}
      <div className="drop-zone-label">{label}</div>
      <div className="drop-zone-icon">📄</div>
      <div className="drop-zone-text">
        <strong>Tap</strong> or drop
      </div>
      {file && <div className="file-name">{file.name}</div>}
      <input
        ref={inputRef}
        type="file"
        className="file-input"
        accept=".png,.jpg,.jpeg,.bmp,.tiff,.tif,.webp,.pdf"
        onChange={handleChange}
      />
    </div>
  );
}
