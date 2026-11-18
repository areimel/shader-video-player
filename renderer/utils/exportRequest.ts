import type { ExportRequest } from "../../shared/jobs";
import { CUSTOM } from "./effectSettings";

export type ExportSize = ExportRequest["size"];

/** The part of the effect settings an export bakes in (a subset of `EffectSettings`). */
export interface ExportFx {
  effect: { id: string } | null;
  values: Record<string, number>;
  presetId: string;
}

/** Builds the export request, or null when no effect is on. Values are copied; an edited look has no preset id. */
export function buildExportRequest(
  fx: ExportFx,
  size: ExportSize,
  windowSize: { width: number; height: number },
  audioOrdinal = 0,
): ExportRequest | null {
  if (!fx.effect) return null;
  const req: ExportRequest = {
    effectId: fx.effect.id,
    presetId: fx.presetId === CUSTOM ? null : fx.presetId,
    values: { ...fx.values },
    size,
    audioOrdinal,
  };
  if (size === "window") {
    req.windowSize = { width: Math.max(1, Math.round(windowSize.width)), height: Math.max(1, Math.round(windowSize.height)) };
  }
  return req;
}
