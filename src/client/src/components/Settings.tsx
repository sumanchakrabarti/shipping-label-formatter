const FIT_LABELS: Record<string, string> = {
  fit: "Fit",
  fill: "Fill",
  stretch: "Stretch",
};

interface SettingsProps {
  labelSize: string;
  fitMode: string;
  autoCrop: boolean;
  onLabelSizeChange: (v: string) => void;
  onFitModeChange: (v: string) => void;
  onAutoCropChange: (v: boolean) => void;
  onReset: () => void;
}

export default function Settings({
  labelSize,
  fitMode,
  autoCrop,
  onLabelSizeChange,
  onFitModeChange,
  onAutoCropChange,
  onReset,
}: SettingsProps) {
  const sizeText = labelSize.replace("x", "×");
  const fitText = FIT_LABELS[fitMode] ?? fitMode;
  const cropText = autoCrop ? "Auto-crop" : "No crop";

  return (
    <details className="settings">
      <summary>
        <span className="settings-label">Settings</span>
        <span className="settings-summary-text">
          {sizeText} · {fitText} · {cropText}
        </span>
      </summary>
      <div className="settings-body">
        <div className="option-row">
          <label htmlFor="labelSizeSelect">Label Size</label>
          <select
            id="labelSizeSelect"
            value={labelSize}
            onChange={(e) => onLabelSizeChange(e.target.value)}
          >
            <option value="4x6">4×6 inches</option>
            <option value="4x8">4×8 inches</option>
          </select>
        </div>

        <div className="option-row">
          <label htmlFor="fitSelect">Fit Mode</label>
          <select
            id="fitSelect"
            value={fitMode}
            onChange={(e) => onFitModeChange(e.target.value)}
          >
            <option value="fit">Fit (white margins)</option>
            <option value="fill">Fill (crop excess)</option>
            <option value="stretch">Stretch</option>
          </select>
        </div>

        <div className="option-row">
          <label htmlFor="autoCropCheck">Auto-Crop to Border</label>
          <input
            type="checkbox"
            id="autoCropCheck"
            checked={autoCrop}
            onChange={(e) => onAutoCropChange(e.target.checked)}
          />
        </div>

        <button
          type="button"
          className="settings-reset-btn"
          onClick={onReset}
        >
          Reset to defaults
        </button>
      </div>
    </details>
  );
}
