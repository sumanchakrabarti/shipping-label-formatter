import { useState, useCallback } from "react";
import DropZone from "./components/DropZone";
import PagePreview from "./components/PagePreview";
import Settings from "./components/Settings";
import OutputPreview from "./components/OutputPreview";
import CropRotateModal from "./components/CropRotateModal";
import PdfPageSelector from "./components/PdfPageSelector";
import PdfDropZone from "./components/PdfDropZone";
import { applyEditsToFile, type CropRotateResult } from "./lib/image-edit";
import { getPdfPageCount } from "./lib/pdf-preview";

interface StatusMessage {
  text: string;
  type: "" | "success" | "error";
}

type AppMode = "shipping" | "pdf";
type PdfAction = "merge" | "select";

export default function App() {
  const [mode, setMode] = useState<AppMode>("shipping");
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [selectedPage1, setSelectedPage1] = useState(1);
  const [selectedPage2, setSelectedPage2] = useState(1);
  const [pdfAction, setPdfAction] = useState<PdfAction>("merge");
  const [mergeFiles, setMergeFiles] = useState<File[]>([]);
  const [selectFile, setSelectFile] = useState<File | null>(null);
  const [selectedPdfPages, setSelectedPdfPages] = useState<number[]>([]);
  const [selectFilePageCount, setSelectFilePageCount] = useState<number | null>(null);
  const [labelSize, setLabelSize] = useState("4x6");
  const [fitMode, setFitMode] = useState("fit");
  const [autoCrop, setAutoCrop] = useState(true);
  const [status, setStatus] = useState<StatusMessage>({ text: "", type: "" });
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [cropSlot, setCropSlot] = useState<1 | 2 | null>(null);

  const cropAspectRatio = (() => {
    const [w, h] = labelSize.split("x").map(Number);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return undefined;
    return w / h;
  })();

  const handleResize = useCallback(async () => {
    if (!file1) return;

    const formData = new FormData();
    formData.append("file", file1);
    formData.append("page", String(selectedPage1));
    if (file2) {
      formData.append("file2", file2);
      formData.append("page2", String(selectedPage2));
    }
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
  }, [file1, file2, selectedPage1, selectedPage2, fitMode, autoCrop, labelSize]);

  const handleModifyPdf = useCallback(async () => {
    const formData = new FormData();
    formData.append("action", pdfAction);

    if (pdfAction === "merge") {
      if (mergeFiles.length < 2) {
        setStatus({ text: "❌ Add at least two PDF files to merge", type: "error" });
        return;
      }
      for (const file of mergeFiles) {
        formData.append("files", file);
      }
    } else {
      if (!selectFile) {
        setStatus({ text: "❌ Select a PDF file first", type: "error" });
        return;
      }
      if (!selectedPdfPages.length) {
        setStatus({ text: "❌ Select at least one page", type: "error" });
        return;
      }
      formData.append("files", selectFile);
      formData.append("pages", selectedPdfPages.join(","));
    }

    setIsProcessing(true);
    setStatus({ text: "Processing…", type: "" });
    setPdfBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    try {
      const resp = await fetch("/pdf/modify", { method: "POST", body: formData });
      if (!resp.ok) {
        const err = (await resp.json()) as { error?: string };
        throw new Error(err.error || "PDF operation failed");
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
      setPdfFileName(pdfAction === "merge" ? "merged.pdf" : "selected_pages.pdf");
      setStatus({ text: "✅ PDF ready", type: "success" });
    } catch (e) {
      setStatus({
        text: "❌ " + (e instanceof Error ? e.message : "Unknown error"),
        type: "error",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [pdfAction, mergeFiles, selectFile, selectedPdfPages]);

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

  const handleEditImage = useCallback((slot: 1 | 2) => {
    setCropSlot(slot);
  }, []);

  const handleCropApply = useCallback(
    async (result: CropRotateResult) => {
      if (!cropSlot) return;
      const origFile = cropSlot === 1 ? file1 : file2;
      if (!origFile) return;
      const editedFile = await applyEditsToFile(origFile, result);
      if (cropSlot === 1) setFile1(editedFile);
      else setFile2(editedFile);
      setCropSlot(null);
    },
    [cropSlot, file1, file2],
  );

  const handleCropCancel = useCallback(() => setCropSlot(null), []);

  const handleModeChange = useCallback((nextMode: AppMode) => {
    setMode(nextMode);
    setStatus({ text: "", type: "" });
    setCropSlot(null);
  }, []);

  const handleSelectFile = useCallback(async (file: File | null) => {
    setSelectFile(file);
    setSelectedPdfPages([]);
    if (!file) {
      setSelectFilePageCount(null);
      return;
    }
    try {
      const count = await getPdfPageCount(file);
      setSelectFilePageCount(count);
      setSelectedPdfPages(Array.from({ length: count }, (_, i) => i + 1));
    } catch {
      setSelectFilePageCount(null);
    }
  }, []);

  return (
    <div className="container">
      <h1>📦 Shipping Label &amp; PDF Toolkit</h1>

      <div className="mode-menu" role="tablist" aria-label="App mode">
        <button
          type="button"
          className={`mode-btn ${mode === "shipping" ? "active" : ""}`}
          onClick={() => handleModeChange("shipping")}
          role="tab"
          aria-selected={mode === "shipping"}
        >
          Configure Shipping Labels
        </button>
        <button
          type="button"
          className={`mode-btn ${mode === "pdf" ? "active" : ""}`}
          onClick={() => handleModeChange("pdf")}
          role="tab"
          aria-selected={mode === "pdf"}
        >
          Modify PDFs
        </button>
      </div>

      <p className="subtitle">
        {mode === "shipping"
          ? "Two labels on one 8.5×11 landscape page"
          : "Merge PDFs or select exact pages into a new PDF"}
      </p>

      {mode === "shipping" ? (
        <>
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

          <PagePreview
            file1={file1}
            file2={file2}
            labelSize={labelSize}
            selectedPage1={selectedPage1}
            selectedPage2={selectedPage2}
            onSelectedPageChange={(slot, page) => {
              if (slot === 1) setSelectedPage1(page);
              else setSelectedPage2(page);
            }}
            onEditImage={handleEditImage}
          />

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
        </>
      ) : (
        <>
          <div className="pdf-actions">
            <button
              type="button"
              className={`pdf-action-btn ${pdfAction === "merge" ? "active" : ""}`}
              onClick={() => setPdfAction("merge")}
            >
              Merge PDFs
            </button>
            <button
              type="button"
              className={`pdf-action-btn ${pdfAction === "select" ? "active" : ""}`}
              onClick={() => setPdfAction("select")}
            >
              Select Pages
            </button>
          </div>

          {pdfAction === "merge" ? (
            <div className="pdf-panel">
              <PdfDropZone
                label="Merge Source PDFs"
                files={mergeFiles}
                multiple
                onFilesChange={setMergeFiles}
                onClear={() => setMergeFiles([])}
              />
              {mergeFiles.length > 0 && (
                <ul className="pdf-file-list">
                  {mergeFiles.map((file, idx) => (
                    <li key={`${file.name}-${idx}`}>{file.name}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="pdf-panel">
              <PdfDropZone
                label="PDF for Page Selection"
                files={selectFile ? [selectFile] : []}
                onFilesChange={(files) => {
                  void handleSelectFile(files[0] ?? null);
                }}
                onClear={() => {
                  void handleSelectFile(null);
                }}
              />
              {selectFile && (
                <div className="pdf-file-meta">{selectFile.name}</div>
              )}
              {selectFilePageCount && (
                <div className="pdf-file-meta">{selectFilePageCount} pages available</div>
              )}

              <PdfPageSelector
                file={selectFile}
                selectedPages={selectedPdfPages}
                onChange={setSelectedPdfPages}
              />
            </div>
          )}

          <div className="btn-row">
            <button
              className="btn btn-primary"
              disabled={isProcessing}
              onClick={handleModifyPdf}
            >
              {isProcessing ? "Processing…" : "Generate PDF"}
            </button>
            {pdfBlobUrl && (
              <button className="btn btn-success" onClick={handleDownload}>
                ⬇ Download
              </button>
            )}
          </div>
        </>
      )}

      {pdfBlobUrl && <OutputPreview blobUrl={pdfBlobUrl} />}

      {status.text && (
        <div className={`status ${status.type}`}>
          {isProcessing && <span className="spinner" />}
          {status.text}
        </div>
      )}

      {mode === "shipping" && cropSlot && (cropSlot === 1 ? file1 : file2) && (
        <CropRotateModal
          file={(cropSlot === 1 ? file1 : file2)!}
          aspectRatio={cropAspectRatio}
          onApply={handleCropApply}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
