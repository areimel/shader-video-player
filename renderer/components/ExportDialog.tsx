import { useState } from "react";
import type { FeatureDeps } from "../hooks/featureTypes";
import { buildExportRequest, type ExportSize } from "../utils/exportRequest";
import { CUSTOM } from "../utils/effectSettings";
import { Button } from "./common/Button";
import { Dialog } from "./common/Dialog";
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
export function ExportDialog({ fx, audioOrdinal, onClose }: { fx: FeatureDeps["fx"]; audioOrdinal: number; onClose: () => void }) {
  const [size, setSize] = useState<ExportSize>("source");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preset = fx.selected?.presets.find((p) => p.id === fx.presetId);
  const look = fx.effect ? `${fx.effect.label} · ${fx.presetId === CUSTOM || !preset ? "Custom" : preset.label}` : null;

  const start = async () => {
    const req = buildExportRequest(fx, size, windowPixels(), audioOrdinal);
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

  return (
    <Dialog title="Export with effect" onDismiss={onClose} busy={busy}
      actions={<>
        <Button variant="quiet" onClick={onClose}>Cancel</Button>
        <Button onClick={start} disabled={!fx.effect || busy}>{busy ? "Exporting…" : "Export…"}</Button>
      </>}>
      <p>{look ? <>Baked in: <strong>{look}</strong></> : "Turn an effect on first."}</p>
      <div className="dialog-field">
        <span className="dialog-note">Size</span>
        <Segmented options={SIZES} value={size} label="Export size" onChange={setSize} />
      </div>
      <p className="dialog-note">Renders every frame through the effect; takes longer than the video's length.</p>
      {error && <p className="dialog-error" role="alert">{error}</p>}
    </Dialog>
  );
}
