/** Hidden export page: renders frames sent by the main process through an effect and returns pixels. */
import type { ExportPageBridge } from "../../shared/exportPage";
import { OfflineRenderer } from "../shader/gl/offlineRenderer";
import { EFFECTS } from "../shader/effects/registry";
import { resolveExportSettings } from "../utils/exportSettings";

declare global {
  interface Window { svpExport?: ExportPageBridge }
}

const bridge = window.svpExport;
if (!bridge) throw new Error("export bridge missing");

let renderer: OfflineRenderer | null = null;
let fps = 30;
let failed = false;

const fail = (e: unknown): void => {
  if (failed) return;
  failed = true;
  bridge.sendError(e instanceof Error ? e.message : String(e));
};

bridge.onInit((init) => {
  try {
    const { effect, values } = resolveExportSettings(EFFECTS, { effect: init.effectId, preset: init.presetId, raw: init.raw });
    fps = init.fps;
    renderer = new OfflineRenderer({ effect, values, sourceSize: init.sourceSize, outputSize: init.outputSize });
  } catch (e) {
    fail(e);
  }
});

bridge.onFrame(({ n, bytes }) => {
  if (failed) return;
  try {
    if (!renderer) throw new Error("Frame arrived before the effect was ready");
    bridge.sendPixels(n, renderer.renderFrame(bytes, n, fps));
  } catch (e) {
    fail(e);
  }
});

bridge.onEnd(() => {
  renderer?.dispose();
  renderer = null;
});

bridge.ready();
