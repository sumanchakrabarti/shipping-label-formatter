import { useState, useCallback } from "react";
import DropZone from "./components/DropZone";
import PagePreview from "./components/PagePreview";
import Settings from "./components/Settings";
import OutputPreview from "./components/OutputPreview";

interface StatusMessage {
  text: string;
  type: "" | "success" | "error";
}

export default function App() {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [labelSize, setLabelSize] = useState("4x6");
  const [fitMode, setFitMode] = useState("fit");
  const [autoCrop, setAutoCrop] = useState(true);
  const [status, setStatus] = useState<StatusMessage>({ text: "", type: "" });
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleResize = useCallback(async () => {
    if (!file1) return;

    const formData = new FormData();
    formData.append("file", file1);
    if (file2) formData.append("file2", file2);
    formData.append("fit", fitMode);
    formData.append("auto_crop", autoCrop ? "true" : "false");
    formData.append("label_size", labelSize);

    setIsProcessing(true);
    setStatus({ text: "Processing…", type: "" });
    setPdfBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    try {
      const resp = await fetch("/resize", { method: "POST", body: formData });
      if (!resp.ok) {
        const err = (await resp.json()) as { error?: string };
        throw new Error(err.error || "Resize failed");
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
      setPdfFileName(file1.name.replace(/\.[^.]+$/, "") + "_label.pdf");
      setStatus({ text: "✅ Preview ready", type: "success" });
    } catch (e) {
      setStatus({
        text: "❌ " + (e instanceof Error ? e.message : "Unknown error"),
        type: "error",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [file1, file2, fitMode, autoCrop, labelSize]);

  const handleDownload = useCallback(() => {
    if (!pdfBlobUrl) return;
    const a = document.createElement("a");
    a.href = pdfBlobUrl;
    a.download = pdfFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [pdfBlobUrl, pdfFileName]);

  const handlePrint = useCallback(() => {
    if (!pdfBlobUrl) return;
    const w = window.open(pdfBlobUrl);
    if (w) {
      w.addEventListener("load", () => {
        w.focus();
        w.print();
      });
    }
  }, [pdfBlobUrl]);

  const handleResetSettings = useCallback(() => {
    setLabelSize("4x6");
    setFitMode("fit");
    setAutoCrop(true);
  }, []);

  return (
    <div className="container">
      <h1>📦 Label Resize &amp; Print</h1>
      <p className="subtitle">Two labels on one 8.5×11 landscape page</p>

      <div className="drop-zones">
        <DropZone
          label="Left Label"
          file={file1}
          onFile={setFile1}
          onClear={() => setFile1(null)}
        />
        <DropZone
          label="Right Label (optional)"
          file={file2}
          onFile={setFile2}
          onClear={() => setFile2(null)}
        />
      </div>

      <PagePreview file1={file1} file2={file2} labelSize={labelSize} />

      <Settings
        labelSize={labelSize}
        fitMode={fitMode}
        autoCrop={autoCrop}
        onLabelSizeChange={setLabelSize}
        onFitModeChange={setFitMode}
        onAutoCropChange={setAutoCrop}
        onReset={handleResetSettings}
      />

      <div className="btn-row">
        <button
          className="btn btn-primary"
          disabled={!file1 || isProcessing}
          onClick={handleResize}
        >
          {isProcessing ? "Processing…" : "Resize & Preview"}
        </button>
        {pdfBlobUrl && (
          <>
            <button className="btn btn-success" onClick={handleDownload}>
              ⬇ Download
            </button>
            <button className="btn btn-primary" onClick={handlePrint}>
              🖨 Print
            </button>
          </>
        )}
      </div>

      {pdfBlobUrl && <OutputPreview blobUrl={pdfBlobUrl} />}

      {status.text && (
        <div className={`status ${status.type}`}>
          {isProcessing && <span className="spinner" />}
          {status.text}
        </div>
      )}
    </div>
  );
}
