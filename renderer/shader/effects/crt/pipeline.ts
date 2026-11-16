import type { PassSpec, SizeEnv } from "../../gl/passGraph";
import { TUBE_MAIN_INPUTS, tubePasses } from "../shared/tube/pipeline";
import raster from "./passes/raster.frag?raw";
import signalEncode from "./passes/signal-encode.frag?raw";
import signalDecode from "./passes/signal-decode.frag?raw";
import main from "./passes/main.frag?raw";

/** The virtual raster the tube draws: `d_virtualWidth` samples by `d_virtualLines` lines. */
const rasterSize = ({ values }: SizeEnv) => ({ width: values.d_virtualWidth, height: values.d_virtualLines });

/** Only the last pass runs at screen resolution; everything before it is raster-sized or smaller. */
export const CRT_PASSES: PassSpec[] = [
  { id: "raster", frag: raster, inputs: { uSource: "video" }, size: rasterSize, mipmapInputs: true },
  { id: "signalEncode", frag: signalEncode, inputs: { uSource: "raster" }, size: rasterSize },
  { id: "signalDecode", frag: signalDecode, inputs: { uSource: "signalEncode" }, size: rasterSize },
  ...tubePasses("signalDecode", { rasterSize }),
  { id: "main", frag: main, inputs: { ...TUBE_MAIN_INPUTS }, size: "viewport" },
];
