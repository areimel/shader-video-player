import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { FeatureDeps } from "../hooks/featureTypes";
import { buildExportRequest, type ExportSize } from "../utils/exportRequest";
import { CUSTOM } from "../utils/effectSettings";
import { Button } from "./common/Button";
import { Panel, PanelHeader } from "./common/Panel";
import { Segmented } from "./common/Segmented";

const SIZES = [
  { value: "source" as ExportSize, label: "Source (min 1080p)" },
  { value: "1080p" as ExportSize, label: "1080p" },
  { value: "window" as ExportSize, label: "Window size" },
];

const windowPixels = () => ({
  width: window.innerWidth * window.devicePixelRatio,
  height: window.innerHeight * window.devicePixelRatio,
});

/** Modal for "Export with effect": shows the look that will be baked in and the output size. */
export function ExportDialog({ fx, onClose }: { fx: FeatureDeps["fx"]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ExportSize>("source");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const preset = fx.selected?.presets.find((p) => p.id === fx.presetId);
  const look = fx.effect ? `${fx.effect.label} · ${fx.presetId === CUSTOM || !preset ? "Custom" : preset.label}` : null;

  const start = async () => {
    const req = buildExportRequest(fx, size, windowPixels());
    if (!req) return;
    setBusy(true);
    setError(null);
    try {
      await window.player.exportCurrent(req);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  // Single-key shortcuts listen on window; keep keys typed in the dialog from reaching them.
  const stopKeys = (e: KeyboardEvent) => { if (e.key !== "Escape") e.stopPropagation(); };

  return (
    <div className="help-backdrop" onKeyDown={stopKeys}>
      <Panel className="export-dialog" role="dialog" aria-modal="true" aria-label="Export with effect"
        onDismiss={busy ? undefined : onClose} dismissOutside>
        <div ref={ref} tabIndex={-1} className="export-body">
          <PanelHeader title="Export with effect" />
          <p className="export-look">
            {look ? <>Baked in: <strong>{look}</strong></> : "Turn an effect on first."}
          </p>
          <div className="export-size">
            <span className="sub-label">Size</span>
            <Segmented options={SIZES} value={size} label="Export size" onChange={setSize} />
          </div>
          <p className="export-note">Renders every frame through the effect; takes longer than the video's length.</p>
          {error && <p className="job-error" role="alert">{error}</p>}
          <div className="export-actions">
            <Button variant="quiet" onClick={onClose}>Cancel</Button>
            <Button onClick={start} disabled={!fx.effect || busy}>{busy ? "Exporting…" : "Export…"}</Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
