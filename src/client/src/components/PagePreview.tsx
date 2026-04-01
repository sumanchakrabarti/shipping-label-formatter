import { useEffect, useState } from "react";
import { renderPdfToDataUrl } from "../lib/pdf-preview";

interface PagePreviewProps {
  file1: File | null;
  file2: File | null;
  labelSize: string;
  onEditImage?: (slot: 1 | 2) => void;
}

function PreviewSlot({
  file,
  labelSize,
  placeholder,
  onEdit,
}: {
  file: File | null;
  labelSize: string;
  placeholder: string;
  onEdit?: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [w, h] = labelSize.split("x").map(Number);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "pdf") {
      setPreview(null);
      renderPdfToDataUrl(file, 300)
        .then(setPreview)
        .catch(() => setPreview(null));
    } else {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  }, [file]);

  const handleClick = () => {
    if (preview && onEdit) onEdit();
  };

  return (
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
  );
}

export default function PagePreview({ file1, file2, labelSize, onEditImage }: PagePreviewProps) {
  return (
    <div className="page-preview">
      <PreviewSlot
        file={file1}
        labelSize={labelSize}
        placeholder="Left"
        onEdit={onEditImage ? () => onEditImage(1) : undefined}
      />
      <PreviewSlot
        file={file2}
        labelSize={labelSize}
        placeholder="Right"
        onEdit={onEditImage ? () => onEditImage(2) : undefined}
      />
    </div>
  );
}
