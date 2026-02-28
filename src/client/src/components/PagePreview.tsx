import { useEffect, useState } from "react";
import { renderPdfToDataUrl } from "../lib/pdf-preview";

interface PagePreviewProps {
  file1: File | null;
  file2: File | null;
  labelSize: string;
}

function PreviewSlot({
  file,
  labelSize,
  placeholder,
}: {
  file: File | null;
  labelSize: string;
  placeholder: string;
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

  return (
    <div
      className={`slot ${file ? "filled" : ""}`}
      style={{ aspectRatio: `${w} / ${h}` }}
    >
      {preview ? (
        <img src={preview} alt="preview" />
      ) : (
        placeholder
      )}
    </div>
  );
}

export default function PagePreview({ file1, file2, labelSize }: PagePreviewProps) {
  return (
    <div className="page-preview">
      <PreviewSlot file={file1} labelSize={labelSize} placeholder="Left" />
      <PreviewSlot file={file2} labelSize={labelSize} placeholder="Right" />
    </div>
  );
}
