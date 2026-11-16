import { range, select, toggle } from "../params";
import type { ParamSpec } from "../types";
import { tubeGroupNames, tubeParams, type TubeGroups } from "../shared/tube/params";

const TUBE_GROUPS: TubeGroups = { beam: "TV: Beam", mask: "TV: Mask", glow: "TV: Glow", geometry: "TV: Geometry", screen: "TV: Screen" };

export const VHS_GROUPS = ["Picture", "Tape", "Tracking", "Output", "OSD", "TV", ...tubeGroupNames(TUBE_GROUPS)];

/** Option orders are part of the shader contract. */
export const FRAME_FIT = { keep: 0, crop: 1, letterbox: 2 } as const;
export const TAPE_LINES = [240, 480]; // index -> rows
export const TAPE_LINES_CHOICE = { rows240: 0, rows480: 1 } as const;
export const TAPE_SPEED = { sp: 0, lp: 1, ep: 2 } as const;
export const CONNECTION = { yc: 0, composite: 1 } as const;
export const OSD_MODE = { off: 0, vcr: 1, camcorder: 2 } as const;
// Month names in osd.glsl OSD_MONTH_GLYPHS order (glsl/osd.glsl indexes its glyph table by this index): keep in step.
export const OSD_MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const OSD_MONTH_NOV = OSD_MONTHS.indexOf("NOV");

export const VHS_PARAMS: ParamSpec[] = [
  // Picture
  select("frameFit", "Frame", "Picture", ["Keep aspect", "4:3 crop", "4:3 letterbox"], FRAME_FIT.keep),
  select("tapeLines", "Tape lines", "Picture", TAPE_LINES.map(String), TAPE_LINES_CHOICE.rows480,
    { hint: "240: one tape row per field line (softer, half the rows). 480: two rows per field line, one per field." }),
  range("saturation", "Saturation", "Picture", 0, 2, 0.01, 1),
  range("tint", "Tint", "Picture", -30, 30, 1, 0, { unit: "°" }),

  // Tape
  select("tapeSpeed", "Tape speed", "Tape", ["SP", "LP", "EP"], TAPE_SPEED.sp),
  range("lumaBandwidthSP", "Luma bandwidth", "Tape", 1.5, 6.5, 0.1, 3.0,
    { unit: "MHz", hint: "At SP; LP/EP and dubbing lower it. ~3 = VHS, ~5 = S-VHS." }),
  range("chromaBandwidthSP", "Chroma bandwidth", "Tape", 0.2, 1.5, 0.05, 0.4, { unit: "MHz" }),
  range("sharpening", "Sharpening", "Tape", 0, 1, 0.01, 0.3),
  range("chromaDelay", "Chroma delay", "Tape", -2, 4, 0.1, 1, { unit: "px" }),
  range("chromaSmear", "Vertical chroma smear", "Tape", 0, 2, 0.05, 1,
    { hint: "1 = the deck's 1H comb; 2 = two in a row." }),
  range("lumaNoise", "Luma noise", "Tape", 0, 1, 0.01, 0.15, { animated: true }),
  range("chromaNoise", "Chroma noise", "Tape", 0, 1, 0.01, 0.2, { animated: true }),
  range("generation", "Generation loss", "Tape", 0, 3, 0.1, 0,
    { hint: "Copies made from the original (0 = the original recording)." }),

  // Tracking
  range("lineJitter", "Line jitter", "Tracking", 0, 2, 0.05, 0.25, { unit: "px", animated: true }),
  range("wobble", "Wobble", "Tracking", 0, 4, 0.05, 0.4, { unit: "px", animated: true }),
  range("topSkew", "Top skew", "Tracking", 0, 10, 0.1, 1.5, { unit: "px", animated: true }),
  range("headSwitch", "Head-switch height", "Tracking", 0, 16, 1, 5, { unit: "lines" }),
  range("headSwitchNoise", "Head-switch noise", "Tracking", 0, 1, 0.01, 0.3, { animated: true }),
  range("tracking", "Tracking error", "Tracking", 0, 1, 0.01, 0, { animated: true }),
  range("trackingRoll", "Band roll", "Tracking", -0.5, 0.5, 0.01, 0.08, { unit: "/s" }),
  range("dropouts", "Dropouts", "Tracking", 0, 3, 0.01, 0.03, { unit: "/field", animated: true }),
  range("dropoutLength", "Dropout length", "Tracking", 1, 40, 0.5, 8, { unit: "µs" }),

  // Output
  select("connection", "Connection", "Output", ["Y/C (S-Video)", "Composite"], CONNECTION.composite),
  range("artifacting", "Rainbowing", "Output", 0, 2, 0.05, 1),
  range("fringing", "Dot crawl", "Output", 0, 2, 0.05, 1),
  toggle("crawl", "Animate crawl", "Output", true),

  // OSD
  select("osdMode", "On-screen display", "OSD", ["Off", "VCR", "Camcorder"], OSD_MODE.off),
  select("osdMonth", "Month", "OSD", OSD_MONTHS, OSD_MONTH_NOV),
  range("osdDay", "Day", "OSD", 1, 31, 1, 15),
  range("osdYear", "Year", "OSD", 1976, 2009, 1, 1994),
  range("osdHour", "Clock start", "OSD", 0, 23, 1, 14, { unit: "h" }),

  // TV
  toggle("tv", "Show on a TV", "TV", false),
  ...tubeParams({ beam: "TV: Beam", mask: "TV: Mask", glow: "TV: Glow", geometry: "TV: Geometry", screen: "TV: Screen" }),
];
