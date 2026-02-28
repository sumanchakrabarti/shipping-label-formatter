/**
 * Client-side logic for Label Resize & Print.
 * Handles file drop zones, settings, resize/preview, download, and print.
 */

// ---------------------------------------------------------------------------
// PDF.js setup
// ---------------------------------------------------------------------------

import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.mjs";

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el as T;
}

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------

const dom = {
  resizeBtn:       $<HTMLButtonElement>("resizeBtn"),
  downloadBtn:     $<HTMLButtonElement>("downloadBtn"),
  printBtn:        $<HTMLButtonElement>("printBtn"),
  status:          $<HTMLDivElement>("status"),
  outputSection:   $<HTMLDivElement>("outputSection"),
  outputPreview:   $<HTMLDivElement>("outputPreview"),
  labelSize:       $<HTMLSelectElement>("labelSizeSelect"),
  fitSelect:       $<HTMLSelectElement>("fitSelect"),
  autoCrop:        $<HTMLInputElement>("autoCropCheck"),
  settingsSummary: $<HTMLSpanElement>("settingsSummary"),
  slot1:           $<HTMLDivElement>("slot1"),
  slot2:           $<HTMLDivElement>("slot2"),
  clearBtn1:       $<HTMLButtonElement>("clearBtn1"),
  clearBtn2:       $<HTMLButtonElement>("clearBtn2"),
  resetSettings:   $<HTMLButtonElement>("resetSettingsBtn"),
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let file1: File | null = null;
let file2: File | null = null;
let pdfBlobUrl: string | null = null;
let pdfFileName = "";

// ---------------------------------------------------------------------------
// Service Worker (PWA)
// ---------------------------------------------------------------------------

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/static/sw.js").catch(() => {});
}

// ---------------------------------------------------------------------------
// PDF preview helper
// ---------------------------------------------------------------------------

async function renderPdfToDataUrl(
  file: File,
  maxDim = 300,
): Promise<string> {
  const arrayBuf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
  const page = await pdf.getPage(1);
  const vp = page.getViewport({ scale: 1 });
  const scale = Math.min(maxDim / vp.width, maxDim / vp.height, 2);
  const scaled = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = scaled.width;
  canvas.height = scaled.height;
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport: scaled }).promise;
  return canvas.toDataURL("image/png");
}

// ---------------------------------------------------------------------------
// Drop-zone wiring
// ---------------------------------------------------------------------------

function previewInSlot(file: File, slot: HTMLElement): void {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  slot.classList.add("filled");

  if (ext === "pdf") {
    slot.textContent = "⏳";
    renderPdfToDataUrl(file)
      .then((url) => {
        slot.innerHTML = `<img src="${url}" alt="preview">`;
      })
      .catch(() => {
        slot.textContent = "📄 PDF";
      });
  } else {
    const reader = new FileReader();
    reader.onload = (e) => {
      slot.innerHTML = `<img src="${(e.target as FileReader).result as string}" alt="preview">`;
    };
    reader.readAsDataURL(file);
  }
}

function setupDropZone(
  zoneId: string,
  inputId: string,
  nameId: string,
  slot: HTMLElement,
  setFile: (f: File) => void,
): void {
  const zone = $(zoneId);
  const input = $<HTMLInputElement>(inputId);
  const nameEl = $(nameId);

  zone.addEventListener("click", () => input.click());

  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("dragover");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));

  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("dragover");
    if (e.dataTransfer?.files.length) handleFile(e.dataTransfer.files[0]);
  });

  input.addEventListener("change", () => {
    if (input.files?.length) handleFile(input.files[0]);
  });

  function handleFile(f: File): void {
    setFile(f);
    nameEl.textContent = f.name;
    zone.classList.add("has-file");
    dom.resizeBtn.disabled = !file1;
    dom.status.textContent = "";
    previewInSlot(f, slot);
  }
}

setupDropZone("dropZone1", "fileInput1", "fileName1", dom.slot1, (f) => {
  file1 = f;
});
setupDropZone("dropZone2", "fileInput2", "fileName2", dom.slot2, (f) => {
  file2 = f;
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function updateSettingsSummary(): void {
  const size = dom.labelSize.value.replace("x", "×");
  const fit = dom.fitSelect.selectedOptions[0].text.split(" (")[0];
  const crop = dom.autoCrop.checked ? "Auto-crop" : "No crop";
  dom.settingsSummary.textContent = `${size} · ${fit} · ${crop}`;
}

dom.labelSize.addEventListener("change", () => {
  const [w, h] = dom.labelSize.value.split("x").map(Number);
  dom.slot1.style.aspectRatio = `${w} / ${h}`;
  dom.slot2.style.aspectRatio = `${w} / ${h}`;
  updateSettingsSummary();
});

dom.fitSelect.addEventListener("change", updateSettingsSummary);
dom.autoCrop.addEventListener("change", updateSettingsSummary);

dom.resetSettings.addEventListener("click", () => {
  dom.labelSize.value = "4x6";
  dom.fitSelect.value = "fit";
  dom.autoCrop.checked = true;
  dom.slot1.style.aspectRatio = "4 / 6";
  dom.slot2.style.aspectRatio = "4 / 6";
  updateSettingsSummary();
});

// ---------------------------------------------------------------------------
// Resize & Preview
// ---------------------------------------------------------------------------

dom.resizeBtn.addEventListener("click", async () => {
  if (!file1) return;

  const formData = new FormData();
  formData.append("file", file1);
  if (file2) formData.append("file2", file2);
  formData.append("fit", dom.fitSelect.value);
  formData.append("auto_crop", dom.autoCrop.checked ? "true" : "false");
  formData.append("label_size", dom.labelSize.value);

  dom.resizeBtn.disabled = true;
  dom.status.innerHTML = '<span class="spinner"></span> Processing…';
  dom.status.className = "status";
  dom.outputSection.classList.remove("visible");
  dom.downloadBtn.style.display = "none";
  dom.printBtn.style.display = "none";

  if (pdfBlobUrl) {
    URL.revokeObjectURL(pdfBlobUrl);
    pdfBlobUrl = null;
  }

  try {
    const resp = await fetch("/resize", { method: "POST", body: formData });
    if (!resp.ok) {
      const err = (await resp.json()) as { error?: string };
      throw new Error(err.error || "Resize failed");
    }

    const blob = await resp.blob();
    pdfBlobUrl = URL.createObjectURL(blob);
    pdfFileName = file1.name.replace(/\.[^.]+$/, "") + "_label.pdf";

    // Render output preview via PDF.js
    const arrayBuf = await blob.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
    const page = await pdf.getPage(1);
    const vp = page.getViewport({ scale: 1 });
    const scale = Math.min(520 / vp.width, 2);
    const scaled = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = scaled.width;
    canvas.height = scaled.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport: scaled }).promise;

    dom.outputPreview.innerHTML = "";
    dom.outputPreview.appendChild(canvas);
    dom.outputSection.classList.add("visible");
    dom.downloadBtn.style.display = "";
    dom.printBtn.style.display = "";

    dom.status.textContent = "✅ Preview ready";
    dom.status.className = "status success";
  } catch (e) {
    dom.status.textContent = "❌ " + (e instanceof Error ? e.message : "Unknown error");
    dom.status.className = "status error";
  } finally {
    dom.resizeBtn.disabled = false;
  }
});

// ---------------------------------------------------------------------------
// Download & Print
// ---------------------------------------------------------------------------

dom.downloadBtn.addEventListener("click", () => {
  if (!pdfBlobUrl) return;
  const a = document.createElement("a");
  a.href = pdfBlobUrl;
  a.download = pdfFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});

dom.printBtn.addEventListener("click", () => {
  if (!pdfBlobUrl) return;
  const w = window.open(pdfBlobUrl);
  if (w) {
    w.addEventListener("load", () => {
      w.focus();
      w.print();
    });
  }
});
