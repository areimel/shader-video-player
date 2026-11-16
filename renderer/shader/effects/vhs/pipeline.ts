import type { PassSpec, SizeEnv } from "../../gl/passGraph";
import { TUBE_MAIN_INPUTS, tubePasses } from "../shared/tube/pipeline";
import frame from "./passes/frame.frag?raw";
import tapeH from "./passes/tape-h.frag?raw";
import tapeV from "./passes/tape-v.frag?raw";
import signalEncode from "./passes/signal-encode.frag?raw";
import signalDecode from "./passes/signal-decode.frag?raw";
import main from "./passes/main.frag?raw";

type Values = Record<string, number>;

/** The tape raster: `d_tapeWidth` samples by `d_tapeLines` rows (derive.ts). */
const tapeRaster = ({ values }: SizeEnv) => ({ width: values.d_tapeWidth, height: values.d_tapeLines });
const composite = (v: Values) => v.p_connection > 0.5;
const tvOn = (v: Values) => v.p_tv > 0.5;
const glowOn = (v: Values) => tvOn(v) && v.p_glow > 0;
const diffuseOn = (v: Values) => tvOn(v) && (v.p_halation > 0 || v.p_diffusion > 0);

/**
 * frame -> tapeH -> tapeV -> [signalEncode -> signalDecode] -> [tube passes] -> main. A disabled pass forwards its
 * first input, so main's `uSource` is gamma R'G'B' with the TV off and linear light with it on. With the TV off,
 * uGlow and uDiffuse resolve to that same gamma raster, which main's flat branch never reads. With the TV on but
 * glow / halation / diffusion at 0, display.glsl skips the texture read under the same condition as the predicates
 * above (glow: `p_glow > 0`; diffuse: `p_halation > 0 || p_diffusion > 0`).
 */
export const VHS_PASSES: PassSpec[] = [
  { id: "frame", frag: frame, inputs: { uSource: "video" }, size: tapeRaster, mipmapInputs: true },
  { id: "tapeH", frag: tapeH, inputs: { uSource: "frame" }, size: tapeRaster },
  { id: "tapeV", frag: tapeV, inputs: { uSource: "tapeH" }, size: tapeRaster },
  { id: "signalEncode", frag: signalEncode, inputs: { uSource: "tapeV" }, size: tapeRaster, enabled: composite },
  { id: "signalDecode", frag: signalDecode, inputs: { uSource: "signalEncode" }, size: tapeRaster, enabled: composite },
  ...tubePasses("signalDecode", {
    rasterSize: tapeRaster,
    enabled: { linearize: tvOn, glowH: glowOn, glowV: glowOn, diffuseDown: diffuseOn, diffuseUp: diffuseOn },
  }),
  { id: "main", frag: main, inputs: { ...TUBE_MAIN_INPUTS }, size: "viewport" },
];
