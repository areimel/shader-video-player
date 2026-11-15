import type { PassSpec, SizeEnv } from "../../gl/passGraph";
import raster from "./passes/raster.frag?raw";
import signalEncode from "./passes/signal-encode.frag?raw";
import signalDecode from "./passes/signal-decode.frag?raw";
import linearize from "./passes/linearize.frag?raw";
import glowH from "./passes/glow-h.frag?raw";
import glowV from "./passes/glow-v.frag?raw";
import diffuseDown from "./passes/diffuse-down.frag?raw";
import diffuseUp from "./passes/diffuse-up.frag?raw";
import main from "./passes/main.frag?raw";

const MAX_GLOW_WIDTH = 800;
const DIFFUSE_DIVISOR = 8;

/** The virtual raster the tube draws: `d_virtualWidth` samples by `d_virtualLines` lines. */
const rasterSize = ({ values }: SizeEnv) => ({ width: values.d_virtualWidth, height: values.d_virtualLines });
const glowSize = (env: SizeEnv) => ({ ...rasterSize(env), width: Math.min(env.values.d_virtualWidth, MAX_GLOW_WIDTH) });
const diffuseSize = ({ viewport }: SizeEnv) => ({
  width: Math.max(16, Math.round(viewport.width / DIFFUSE_DIVISOR)),
  height: Math.max(16, Math.round(viewport.height / DIFFUSE_DIVISOR)),
});

/** Only the last pass runs at screen resolution; everything before it is raster-sized or smaller. */
export const CRT_PASSES: PassSpec[] = [
  { id: "raster", frag: raster, inputs: { uSource: "video" }, size: rasterSize, mipmapInputs: true },
  { id: "signalEncode", frag: signalEncode, inputs: { uSource: "raster" }, size: rasterSize },
  { id: "signalDecode", frag: signalDecode, inputs: { uSource: "signalEncode" }, size: rasterSize },
  { id: "linearize", frag: linearize, inputs: { uSource: "signalDecode", uPrev: "linearize:prev" }, size: rasterSize, feedback: true },
  { id: "glowH", frag: glowH, inputs: { uSource: "linearize" }, size: glowSize },
  { id: "glowV", frag: glowV, inputs: { uSource: "glowH" }, size: glowSize },
  { id: "diffuseDown", frag: diffuseDown, inputs: { uSource: "linearize" }, size: diffuseSize },
  { id: "diffuseUp", frag: diffuseUp, inputs: { uSource: "diffuseDown" }, size: diffuseSize },
  { id: "main", frag: main, inputs: { uSource: "linearize", uGlow: "glowV", uDiffuse: "diffuseUp" }, size: "viewport" },
];
