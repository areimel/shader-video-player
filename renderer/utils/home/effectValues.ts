import { FIT } from "../../shader/effects/crt/params";
import { FRAME_FIT } from "../../shader/effects/vhs/params";

interface ParamLike { id: string; kind: string; options?: string[] }

/**
 * Menu-only framing: no overscan (exact 2:1 row mapping, the 2-cell inset replaces it) and
 * letterboxed fit (Crop on a 16:9 tube would cut the top and bottom rows). Each override applies
 * only when the effect declares that parameter.
 */
const OVERRIDES: { id: string; kind: string; value: number }[] = [
  { id: "overscan", kind: "range", value: 0 },
  { id: "contentFit", kind: "select", value: FIT.letterbox },
  { id: "frameFit", kind: "select", value: FRAME_FIT.letterbox },
];

export function homeValues(effect: { params: ParamLike[] }, values: Record<string, number>): Record<string, number> {
  let out: Record<string, number> | null = null;
  for (const o of OVERRIDES) {
    const spec = effect.params.find((p) => p.id === o.id);
    if (!spec || spec.kind !== o.kind) continue;
    if (spec.kind === "select" && spec.options && o.value >= spec.options.length) continue;
    if (values[o.id] === o.value) continue;
    out ??= { ...values };
    out[o.id] = o.value;
  }
  return out ?? values;
}
