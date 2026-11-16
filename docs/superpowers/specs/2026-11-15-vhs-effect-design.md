# VHS effect design

Branch `feature/vhs-effect`, based on `feat/ui-ux-refresh`. Companion to `2026-11-15-shader-video-player-design.md`.

## Context

The player has one effect (CRT). The roadmap's next item is a VHS effect that reuses the analog signal passes. The engine, panel, persistence, `E` toggle and `pnpm check:shaders` already read `EFFECTS` from the registry, so VHS is a new effect folder plus shared-code extraction, tests and docs. No engine (`renderer/shader/gl/`) changes.

Decisions from the user:
- **Display:** tape model plus an optional TV stage (reusing CRT scanline/curvature/glow/mask code) that can be switched off for a flat "capture card" look.
- **OSD:** included, off by default, on in some presets (camcorder date stamp, VCR `PLAY ▶` + counter).
- **Audio:** untouched.
- **Framing:** selectable; default keeps source aspect; 4:3 crop and 4:3 letterbox available.

My calls (correct me if wrong): NTSC only; no PAL/SECAM; no effect chaining; CRT stays first in the registry (first-run default unchanged); picking an effect in the dropdown keeps today's behaviour; no new shortcut.

## Design

### Pipeline (tape space = `d_tapeWidth` × `d_tapeLines`, rgba16f, `requiresFloat`)

```
frame → tapeH → tapeV → signalEncode* → signalDecode* → linearize† → glowH† → glowV† → diffuseDown† → diffuseUp† → main
        * enabled only when Output = Composite      † enabled only when TV stage is on (and the relevant amount > 0)
```

| Pass | Does |
|---|---|
| `frame` | Video → tape raster with framing (keep / 4:3 crop / 4:3 letterbox), area-filtered downsample, picture controls. Draws the **camcorder** OSD (recorded on tape, so it degrades). Outputs YIQ. |
| `tapeH` | Per-line time-base error (jitter, slow wobble, top-of-frame skew/flagging, head-switch displacement in the bottom lines, tracking-band displacement) as a horizontal sample shift; luma low-pass (~3 MHz SP) + edge-sharpening peaking (halos); colour-under chroma low-pass (~0.4 MHz) with rightward chroma delay; band-limited luma noise and streaky low-frequency chroma noise. |
| `tapeV` | Vertical chroma smear/downward shift (1H delay-line comb averaging), dropouts (hash-placed white streaks with a comet tail, partly concealed from the previous line), head-switch and tracking-band noise. Draws the **VCR** OSD (generated after the tape, so it stays crisp into the output stage). |
| `signalEncode/Decode` | Shared composite code: dot crawl and rainbowing on the VCR's composite output. Skipped for the cleaner Y/C output. |
| TV passes + `main` | `main.frag` (VHS's own) branches on `p_tv`: flat upscale to the viewport, or the tube path through the shared beam/geometry/mask/post chunks. |

Rules carried from CLAUDE.md: every artifact is an exact no-op at 0; anything that moves between video frames is gated by an `animated` param; noise seeds from `uFrame`, tape-locked motion from `uVideoFrame`/`uTime`; row indices from `vUv.y * uSourceSize.y` (top-left origin); `textureLod` after early returns and in loops with `break`; nothing adapted from GPL shaders (ntsc-rs, Patchy NTSC, NTSC-Adaptive etc. are off limits; write from the signal maths and say so in the file header).

### Parameters (declared once in `vhs/params.ts`; exact table in the Contract section below)

- **Picture:** frame fit, tape lines (240 / 480), saturation, tint.
- **Tape:** speed select (SP / LP / EP — scales bandwidth and noise in `derive.ts`), luma bandwidth, chroma bandwidth, sharpening, chroma delay, vertical chroma smear, luma noise*, chroma noise*, generation loss.
- **Tracking:** line jitter*, wobble*, top skew*, head-switch height and noise*, tracking error* and band roll speed, dropout rate* and length. (* = `animated`)
- **Output:** connection (Y/C, Composite), artifacting, fringing, crawl.
- **OSD:** mode (Off / VCR / Camcorder), date month/day/year; clock and counter run from `uTime`.
- **TV:** `tv` toggle, then the shared tube parameters under `TV: Beam`, `TV: Mask`, `TV: Glow`, `TV: Geometry`, `TV: Screen`.

Presets (first one is what a new user gets): `home-sp` Home recording (SP), `rental` Worn rental, `ep` Six-hour EP, `camcorder` Camcorder (date stamp on), `vcr-tv` VCR on a TV (TV stage + `PLAY ▶`), `dub` Third-generation dub, `tracking` Bad tracking.

OSD font: an original 5×7 dot-matrix glyph set (digits, `A–Z` subset, `: . / ▶`) packed into `int` constants in a chunk; no texture, no engine change.

### Shared code (so nothing is copied from CRT)

- `renderer/shader/glsl/common/`: `blur.glsl` (moved as-is), `resample.glsl` (area-filter sampling lifted from `crt/passes/raster.frag`), `subcarrier.glsl`, `composite-encode.glsl`, `composite-decode.glsl` — pure functions taking frequencies/flags as arguments, no `p_`/`d_` names inside.
- `renderer/shader/effects/shared/tube/`: `params.ts` (the tube `ParamSpec`s as a builder taking group names, so both effects declare them from one table), `derive.ts` (`tubeRect`, `contentScale`, `pickVirtualLines`, mask width, `exposureGain`, `maskTransmittance` moved from `crt/derive.ts`), `glsl/` (`beam`, `geometry`, `mask`, `post`), `passes/` (`linearize`, `glow-h`, `glow-v`, `diffuse-down`, `diffuse-up`), `pipeline.ts` (`tubePasses(sourceId, enabled?)`).
- `renderer/shader/effects/shared/signal.ts`: `ACTIVE_LINE_US`, `SUBCARRIER_MHZ`, MHz→cycles helpers from `crt/derive.ts`.
- CRT's `signal-encode/decode.frag` become thin wrappers; `crt/index.ts` and `vhs/index.ts` glob their own `glsl/` plus `shared/tube/glsl/`. A test asserts no effect chunk shadows a common chunk name.

CRT must render identically after the extraction (checked by capture comparison, below).

### Tests

- Generalise the definition/`p_`·`d_`-name/sampler checks in `tests/effects/crt.test.ts` into `tests/effects/definitions.test.ts` looping over `EFFECTS` (shader dirs: `effects/<id>/` + `effects/shared/` + `glsl/common/`); CRT-specific contract checks stay in `crt.test.ts`.
- `tests/effects/vhs-derive.test.ts`: tape-speed scaling, cutoffs clamped to Nyquist, framing rects for each fit mode, zero-amount params produce zero derived strengths.
- `tests/effects/tube.test.ts` for the moved helpers (move existing cases, don't duplicate).
- `pnpm check:shaders` picks up VHS automatically.

## Verification

1. Gates green at every commit.
2. **CRT unchanged:** paused-frame captures (noise/jitter/flicker zeroed via `SVP_CAPTURE_EVAL` writing `localStorage`) before and after the extraction, compared with ffmpeg `psnr`; expect identical.
3. **VHS no-op:** all artifact amounts 0, max bandwidth, TV off → capture close to the plain video (psnr vs effect-off capture).
4. **Each artifact:** one capture per preset and per isolated artifact at 1920×1080 on `testsrc-1080p.mp4`, `bars-720p.mp4` and a `fixtures/youtube` clip, read back as images and cropped/zoomed with ffmpeg where needed (head-switch band, dropouts, OSD glyphs, chroma shift on colour bars).
5. Effect switching CRT ↔ VHS and float-target refusal path exercised via `SVP_CAPTURE_KEYS`/`SVP_CAPTURE_EVAL`.
6. Not verifiable without a person (will be reported as such): motion feel of wobble/tracking roll at speed, slider dragging, 4K frame time.

## Contract

Everything below is normative for the implementers of `renderer/shader/effects/vhs/`. Names, units, option orders and channel layouts are fixed here so files written in parallel agree. Where a line says *(phys.)* the model follows the signal/mechanics; *(approx.)* means an artistic stand-in for something not modelled physically. Carry the source notes into the code as comments.

### C0. Files and conventions

```
vhs/params.ts presets.ts derive.ts pipeline.ts index.ts
vhs/passes/frame.frag tape-h.frag tape-v.frag signal-encode.frag signal-decode.frag main.frag
vhs/glsl/timebase.glsl tape-noise.glsl dropout.glsl osd.glsl osd-font.glsl
```

- **Tape raster:** `d_tapeWidth` samples × `d_tapeLines` rows, row 0 = top (`row = int(floor(vUv.y * size.y))`, `x = floor(vUv.x * size.x)`). One *sample* = one tape-raster texel horizontally; every "px"/"samples" unit below means tape samples.
- **Fields:** NTSC has 240 visible lines per field (`FIELD_LINES = 240`). With 480 rows the even rows are field 0 and the odd rows field 1 (`d_fieldStride = 2`); with 240 rows each render shows one field and the parity alternates with `uFrame` (`d_fieldStride = 1`). Anything "per line" in the tape model (time-base error, dropouts, the 1H comb) works on **field lines**, so 480-row mode gets real interlace combing on moving verticals.
- **Seeds:** per-render randomness (noise, jitter, dropouts, head-switch variation) from `uFrame % 1024`; tape-position motion (wobble, tracking-band roll, OSD counter/clock) from `uTime`; subcarrier crawl from `uVideoFrame`. Periodic functions of `uTime` use frequencies that are whole multiples of 0.01 Hz evaluated on `mod(uTime, 100.0)` (seamless wrap, as `crt/glsl/post.glsl`).
- **Signal domain:** all tape and composite passes carry gamma-encoded video (the source's own transfer), exactly as CRT's signal passes. Light-domain work starts at the shared `linearize`.
- **Uniform ownership:** a chunk declares the `p_`/`d_` uniforms it reads; engine uniforms (`uFrame`, `uVideoFrame`, `uTime`, `uOutputSize`, sampler sizes) are declared by the pass. Each uniform is declared once per pass.
- **Selects in GLSL:** compare `p_<id>` against the index ± 0.5 (`p_connection > 0.5`, `abs(p_osdMode - 1.0) < 0.5`). `enabled`/`size` callbacks receive **prefixed** names (`v.p_tv`, `v.d_tapeWidth`).
- **Header of every shader file:** what the pass/chunk does, its input/output layout, and "Written from the signal maths; no code adapted from other implementations." Hashes come from `glsl/common/noise.glsl` (MIT, already credited).

### C1. Parameters (`vhs/params.ts`)

```ts
export const VHS_GROUPS = ["Picture", "Tape", "Tracking", "Output", "OSD", "TV",
  "TV: Beam", "TV: Mask", "TV: Glow", "TV: Geometry", "TV: Screen"];
/** Option orders are part of the shader contract. */
export const FRAME_FIT = { keep: 0, crop: 1, letterbox: 2 } as const;
export const TAPE_LINES = [240, 480];                       // index -> rows
export const TAPE_SPEED = { sp: 0, lp: 1, ep: 2 } as const;
export const CONNECTION = { yc: 0, composite: 1 } as const;
export const OSD_MODE = { off: 0, vcr: 1, camcorder: 2 } as const;
export const OSD_MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
export const VHS_PARAMS: ParamSpec[] = [
  /* the table below, in this order */,
  ...tubeParams({ beam: "TV: Beam", mask: "TV: Mask", glow: "TV: Glow", geometry: "TV: Geometry", screen: "TV: Screen" }),
];
```

(`tubeParams` is whatever the shared-tube extraction names its builder; it must produce the CRT ids of groups Beam, Mask, Glow, Geometry, Screen unchanged.)

| id | label | group | kind | min | max | step | default | unit | anim | notes / hint |
|---|---|---|---|---|---|---|---|---|---|---|
| `frameFit` | Frame | Picture | select `["Keep aspect", "4:3 crop", "4:3 letterbox"]` | | | | 0 | | | `FRAME_FIT` |
| `tapeLines` | Tape lines | Picture | select `["240", "480"]` | | | | 1 | | | `TAPE_LINES`; 240 = one field per render |
| `saturation` | Saturation | Picture | range | 0 | 2 | 0.01 | 1 | | | same meaning as CRT |
| `tint` | Tint | Picture | range | -30 | 30 | 1 | 0 | ° | | same meaning as CRT |
| `tapeSpeed` | Tape speed | Tape | select `["SP", "LP", "EP"]` | | | | 0 | | | `TAPE_SPEED`; scales bandwidth, noise, dropouts in derive |
| `lumaBandwidthSP` | Luma bandwidth | Tape | range | 1.5 | 6.5 | 0.1 | 3.0 | MHz | | hint "At SP; LP/EP and dubbing lower it. ~3 = VHS, ~5 = S-VHS." ≥ 6.1 reaches Nyquist = no filtering |
| `chromaBandwidthSP` | Chroma bandwidth | Tape | range | 0.2 | 1.5 | 0.05 | 0.4 | MHz | | colour-under chroma |
| `sharpening` | Sharpening | Tape | range | 0 | 1 | 0.01 | 0.3 | | | playback detail enhancer: halos |
| `chromaDelay` | Chroma delay | Tape | range | -2 | 4 | 0.1 | 1 | px | | same meaning as CRT (+ = colour lags right); × (1 + generation) in derive |
| `chromaSmear` | Vertical chroma smear | Tape | range | 0 | 2 | 0.05 | 1 | | | hint "1 = the deck's 1H comb; 2 = two in a row" |
| `lumaNoise` | Luma noise | Tape | range | 0 | 1 | 0.01 | 0.15 | | ✓ | 0.15 ≈ 42.5 dB S/N at SP |
| `chromaNoise` | Chroma noise | Tape | range | 0 | 1 | 0.01 | 0.2 | | ✓ | |
| `generation` | Generation loss | Tape | range | 0 | 3 | 0.1 | 0 | | | hint "Copies made from the original (0 = the original recording)." |
| `lineJitter` | Line jitter | Tracking | range | 0 | 2 | 0.05 | 0.25 | px | ✓ | rms time-base error |
| `wobble` | Wobble | Tracking | range | 0 | 4 | 0.05 | 0.4 | px | ✓ | peak |
| `topSkew` | Top skew | Tracking | range | 0 | 10 | 0.1 | 1.5 | px | ✓ | bend at the top of the field |
| `headSwitch` | Head-switch height | Tracking | range | 0 | 16 | 1 | 5 | lines | | field lines at the bottom; 0 = off |
| `headSwitchNoise` | Head-switch noise | Tracking | range | 0 | 1 | 0.01 | 0.3 | | ✓ | |
| `tracking` | Tracking error | Tracking | range | 0 | 1 | 0.01 | 0 | | ✓ | |
| `trackingRoll` | Band roll | Tracking | range | -0.5 | 0.5 | 0.01 | 0.08 | /s | | field heights per second, + = down |
| `dropouts` | Dropouts | Tracking | range | 0 | 3 | 0.01 | 0.03 | /field | ✓ | expected dropouts per field at SP, generation 0 |
| `dropoutLength` | Dropout length | Tracking | range | 1 | 40 | 0.5 | 8 | µs | | mean length |
| `connection` | Connection | Output | select `["Y/C (S-Video)", "Composite"]` | | | | 1 | | | `CONNECTION`. Only S-VHS decks had Y/C out; kept as the clean option |
| `artifacting` | Rainbowing | Output | range | 0 | 2 | 0.05 | 1 | | | same meaning as CRT (composite only) |
| `fringing` | Dot crawl | Output | range | 0 | 2 | 0.05 | 1 | | | same meaning as CRT (composite only) |
| `crawl` | Animate crawl | Output | toggle | | | | true | | | same meaning as CRT |
| `osdMode` | On-screen display | OSD | select `["Off", "VCR", "Camcorder"]` | | | | 0 | | | `OSD_MODE` |
| `osdMonth` | Month | OSD | select `OSD_MONTHS` | | | | 10 | | | NOV |
| `osdDay` | Day | OSD | range | 1 | 31 | 1 | 15 | | | |
| `osdYear` | Year | OSD | range | 1976 | 2009 | 1 | 1994 | | | |
| `osdHour` | Clock start | OSD | range | 0 | 23 | 1 | 14 | h | | camcorder clock = this hour + media time |
| `tv` | Show on a TV | TV | toggle | | | | false | | | enables the tube passes |
| *tube ids* | | TV: … | | | | | | | | reserved: every CRT id in groups Beam, Mask, Glow, Geometry, Screen (`sharpness` … `displayGamma`, including `noise`, `glow`, `flicker`) |

Not declared, on purpose: `phaseMode` (a VCR's composite output is NTSC, always 2-phase), `ringing` (VHS halos come from `sharpening`), `signalNoise`/`jitter` (replaced by the tape model), `signalMode` (different options, hence `connection`). No VHS id collides with a CRT id except the six marked "same meaning".

Exact no-op at 0: `sharpening`, `chromaDelay`, `chromaSmear`, `lumaNoise`, `chromaNoise`, `generation`, `lineJitter`, `wobble`, `topSkew`, `headSwitch` (whole zone), `headSwitchNoise`, `tracking`, `dropouts`, `artifacting`, `fringing`. Bandwidths and `connection` are not artifact amounts: Y/C + both bandwidths at max + all of the above at 0 + TV off is the "close to plain video" configuration.

### C2. Derived values (`vhs/derive.ts`, pure)

Constants (carry the comments):

```ts
import { ACTIVE_LINE_US, SUBCARRIER_MHZ } from "../shared/signal";
// ACTIVE_LINE_US = 52.6: NTSC active line (63.556 µs line − 10.9 µs blanking), SMPTE 170M.
// SUBCARRIER_MHZ = 3.579545 (315/88 MHz), SMPTE 170M.
export const TAPE_SAMPLES_43 = 640;   // samples per 4:3 active line: 12.17/µs, Nyquist 6.08 MHz (above S-VHS luma),
                                      // subcarrier at 3.4 samples/cycle (CRT's 400-sample floor is the alias limit).
export const TAPE_FIELD_LINES = 240;  // visible lines per NTSC field (of 262.5).
const MHZ_TO_CYCLES = ACTIVE_LINE_US / TAPE_SAMPLES_43; // 0.08219 cycles/sample per MHz, for every frame fit (see tapeSize)
const SAMPLES_PER_US = TAPE_SAMPLES_43 / ACTIVE_LINE_US; // 12.167
const GAUSS_3DB = Math.sqrt(Math.LN2) / (2 * Math.PI);   // 0.1325 = sigma * f(-3 dB) of a Gaussian (as crt/glsl/subcarrier.glsl)
const FILTER_ORDER = 3;               // deck low-pass modelled as 3rd-order maximally flat (approx.; real decks are 3rd-5th order)
/** Per speed. Track pitch (NTSC VHS): SP 58 µm, LP 29 µm, EP 19.3 µm. Noise power ∝ 1/track width (phys.) → amplitude √ratio.
 *  Luma: typical consumer-deck specs ~240/220/200 TVL (approx.). Chroma: the colour-under carrier is 629 kHz at every
 *  speed, so chroma bandwidth barely changes. Dropouts: narrower tracks lose more to the same defect (approx.). */
export const SPEED = [
  { luma: 1, chroma: 1, noise: 1, dropouts: 1 },
  { luma: 0.92, chroma: 1, noise: Math.SQRT2, dropouts: 1.5 },
  { luma: 0.83, chroma: 0.95, noise: Math.sqrt(3), dropouts: 2 },
];
const LUMA_NOISE_FULL = 0.05;         // Y rms at lumaNoise = 1 (26 dB). Default 0.15 → 0.0075 ≈ 42.5 dB; VHS SP luma S/N ≈ 42-45 dB.
const CHROMA_NOISE_FULL = 0.05;       // I/Q rms per channel at chromaNoise = 1. Default 0.2 → 0.01 ≈ 40 dB (VHS chroma AM S/N ≈ 40 dB).
const CHROMA_SIGMA_MIN = 0.5, CHROMA_SIGMA_MAX = 6.4; // tapeH has 33 taps: 2.5 sigma = 16 keeps truncation near 1%
const HEAD_SWITCH_SHIFT_US = 1.5;     // timing step between the two heads at the switch point (approx.; typically 1-2 µs)
const TRACKING_SHIFT_US = 1.0;        // peak time-base error inside the mistracking band (approx.)
const DROPOUT_TAIL_US = 3;            // FM limiter/demodulator recovery after the carrier returns (approx.)
const DOC_DELAY_US = 1;               // dropout compensator reaction time before it substitutes the 1H-delayed line (approx.)
const DECODER_LUMA_MHZ = 4.2;         // NTSC luma bandwidth: the receiver/capture card's luma path
const DECODER_CHROMA_MHZ = 1.0;       // consumer notch-filter decoder chroma band (approx.; ~0.6-1.3 MHz in practice)
const OSD_DOT_FIELD_LINES = 2;        // one OSD dot = 2 field lines tall (a 7-dot glyph ≈ 5.8% of picture height)
const OSD_MARGIN = 0.08;              // title-safe margin, fraction of frame width/height
const FRAME_ASPECT_MIN = 0.5, FRAME_ASPECT_MAX = 2.4;
```

Exported pure helpers (unit-tested):

- `frameRect(fit, videoAspect) → { aspect, pictureW, pictureH }`. Non-finite or ≤ 0 `videoAspect` → 4/3. `keep`: `aspect = clamp(videoAspect, MIN, MAX)` and the picture is letterboxed into it (so `(1, 1)` unless the clamp acted). `crop`/`letterbox`: `aspect = 4/3`, `r = videoAspect / aspect`; letterbox → `r > 1 ? (1, 1/r) : (r, 1)`; crop → `r > 1 ? (r, 1) : (1, 1/r)`. This is CRT's `contentScale` rule: call the shared one if its fit argument allows, the result must be identical. `pictureW/H` = picture size as a fraction of the frame (> 1 = cropped).
- `tapeSize(aspect, linesChoice) → { width, height, stride }`: `width = 2 * round(TAPE_SAMPLES_43 * aspect / (4/3) / 2)` (640 at 4:3, 854 at 16:9), `height = TAPE_LINES[linesChoice]`, `stride = height / TAPE_FIELD_LINES`. Keep-aspect widens the *line* (as if the active line lasted 52.6 × aspect/(4/3) µs), so cycles per sample, artifact sizes and OSD dots are the same per picture height in every fit mode.
- `generationScale(g) = (2^(1/(1+g)) − 1)^(1/(2·FILTER_ORDER))`: the −3 dB point of `1 + g` cascaded identical maximally flat filters of order 3 (phys. for that filter family). 1 at g = 0, 0.863 at 1, 0.799 at 2. (Gaussian theory would give 1/√(1+g), far harsher than measured dubs.)
- `combWeights(s) → [w0, w1, w2]` for field lines n, n−1, n−2: `s ≤ 1: [1 − s/2, s/2, 0]`; `s > 1, t = s − 1: [0.5 − t/4, 0.5, t/4]`. Sums to 1; `[1, 0, 0]` at 0.
- `deriveVhs(v, env): ParamValues`.

`deriveVhs` returns (names without prefix; `g = v.generation`, `sp = SPEED[v.tapeSpeed]`, `gs = generationScale(g)`, `frame = frameRect(v.frameFit, video.width / video.height)`):

| d_ name | formula | unit |
|---|---|---|
| `tapeWidth`, `tapeLines`, `fieldStride` | `tapeSize(frame.aspect, v.tapeLines)` | samples, rows, rows per field line |
| `frameAspect` | `frame.aspect` | w/h |
| `pictureW`, `pictureH` | `frame.pictureW`, `frame.pictureH` | fraction of frame |
| `lumaCutoff` | `min(0.5, v.lumaBandwidthSP · sp.luma · gs · MHZ_TO_CYCLES)` | cycles/sample |
| `chromaSigma` | `clamp(GAUSS_3DB / (v.chromaBandwidthSP · sp.chroma · gs · MHZ_TO_CYCLES), MIN, MAX)` | samples |
| `chromaCutoff` | `GAUSS_3DB / chromaSigma` (effective, after the clamp) | cycles/sample |
| `chromaDelay` | `v.chromaDelay · (1 + g)` (group delays add per playback, phys.) | samples |
| `combW0`, `combW1`, `combW2` | `combWeights(v.chromaSmear)` | |
| `lumaNoise` | `v.lumaNoise · LUMA_NOISE_FULL · sp.noise · √(1+g)` (independent equal-power noise per playback, phys.) | Y rms |
| `chromaNoise` | `v.chromaNoise · CHROMA_NOISE_FULL · sp.noise · √(1+g)` | I/Q rms |
| `jitter` | `v.lineJitter · √(1+g)` (independent time-base error per playback) | samples rms |
| `wobble`, `topSkew` | `v.wobble`, `v.topSkew` | samples |
| `headSwitchLines` | `round(v.headSwitch)` | field lines |
| `headSwitchShift` | `lines > 0 ? HEAD_SWITCH_SHIFT_US · SAMPLES_PER_US : 0` (18.25) | samples |
| `headSwitchNoise` | `lines > 0 ? v.headSwitchNoise : 0` | |
| `tracking` | `v.tracking` | 0..1 |
| `trackingRoll` | `v.tracking > 0 ? v.trackingRoll : 0` | field heights/s |
| `trackingShift` | `v.tracking > 0 ? TRACKING_SHIFT_US · SAMPLES_PER_US : 0` | samples |
| `dropoutProb` | `min(0.5, v.dropouts · sp.dropouts · (1+g) / (2 · TAPE_FIELD_LINES))` (2 slots per field line; each copy adds its own dropouts) | per slot |
| `dropoutLen` | `v.dropoutLength · SAMPLES_PER_US` | samples |
| `dropoutTail`, `docDelay` | `DROPOUT_TAIL_US · SAMPLES_PER_US`, `DOC_DELAY_US · SAMPLES_PER_US` | samples |
| `dropoutEdge` | `max(1, 0.5 / lumaCutoff)` (rise time of the luma path: the real streak happens before the low-pass) | samples |
| `subcarrier` | `SUBCARRIER_MHZ · MHZ_TO_CYCLES` (0.2942, every fit) | cycles/sample |
| `decodeLumaCutoff` | `min(0.5, DECODER_LUMA_MHZ · MHZ_TO_CYCLES)` (0.345) | cycles/sample |
| `decodeChromaSigma` | `max(0.8, GAUSS_3DB / (DECODER_CHROMA_MHZ · MHZ_TO_CYCLES))` (1.61; the decoder's whole chroma filter, not a half) | samples |
| `osdDotW` | `max(1, round(OSD_DOT_FIELD_LINES · tapeWidth / (TAPE_FIELD_LINES · frame.aspect)))` (4: square dots) | samples |
| `osdDotH` | `OSD_DOT_FIELD_LINES · fieldStride` | rows |
| `osdMarginX`, `osdMarginY` | `round(OSD_MARGIN · tapeWidth)`, `round(OSD_MARGIN · tapeLines)` | samples, rows |
| tube values | spread the shared tube derive with tube aspect = `frame.aspect`, lines = `tapeLines` (gives `tubeW`, `tubeH`, `pxPerLine`, `scanlineFade`, `maskWidth`, `exposure`, …) | |

The shared tube derive must not return any of the names above (in particular not `contentW/H`, which is why VHS says `pictureW/H`).

Tests (`tests/effects/vhs-derive.test.ts`): `tapeSize` 640×480 stride 2, 640×240 stride 1, 854 wide for 16:9 keep; `frameRect` for 16:9, 4:3, 9:16 and 0×0 video in all three fits; `subcarrier` identical across fits; `lumaCutoff` at defaults = 3.0 · 52.6 / 640, LP/EP scaled, `generationScale(1)` ≈ 0.863, `lumaBandwidthSP` 6.5 → 0.5; `chromaSigma` inside [0.5, 6.4] at every speed/generation extreme and `chromaCutoff · chromaSigma = GAUSS_3DB`; noise ×√2 / ×√3 for LP/EP and ×√(1+g); every zero artifact amount gives 0 for its derived strength (`lumaNoise`, `chromaNoise`, `jitter`, `wobble`, `topSkew`, `chromaDelay`, `headSwitchShift` and `headSwitchNoise` when `headSwitch` = 0, `tracking`, `trackingShift`, `dropoutProb`), and `combW` = [1, 0, 0] at smear 0.

### C3. Passes (`vhs/pipeline.ts`)

```ts
const tapeSize = ({ values }: SizeEnv) => ({ width: values.d_tapeWidth, height: values.d_tapeLines });
const composite = (v: Record<string, number>) => v.p_connection > 0.5;
const tvOn = (v: Record<string, number>) => v.p_tv > 0.5;
export const VHS_PASSES: PassSpec[] = [
  { id: "frame", frag: frame, inputs: { uSource: "video" }, size: tapeSize, mipmapInputs: true },
  { id: "tapeH", frag: tapeH, inputs: { uSource: "frame" }, size: tapeSize },
  { id: "tapeV", frag: tapeV, inputs: { uSource: "tapeH" }, size: tapeSize },
  { id: "signalEncode", frag: signalEncode, inputs: { uSource: "tapeV" }, size: tapeSize, enabled: composite },
  { id: "signalDecode", frag: signalDecode, inputs: { uSource: "signalEncode" }, size: tapeSize, enabled: composite },
  ...tubePasses("signalDecode", tvOn),   // linearize, glowH, glowV, diffuseDown, diffuseUp
  { id: "main", frag: main, inputs: { uSource: "linearize", uGlow: "glowV", uDiffuse: "diffuseUp" }, size: "viewport" },
];
```

All targets rgba16f with linear filtering (tapeH relies on it for fractional shifts); `requiresFloat: true` (signed I/Q, modulated chroma, noise below 0 and above 1). Disabled passes forward their first input, so `main.uSource` is gamma RGB with the TV off and linear RGB with it on. **Alpha is 1 in every pass and carries nothing.**

| pass | input (sampler ← source) | output layout | enabled |
|---|---|---|---|
| `frame` | `uSource` ← video (mipmapped) | rgb = **Y, I, Q** (gamma-encoded, I/Q signed) | always |
| `tapeH` | `uSource` ← frame | rgb = **Y, I, Q** after time base, filters, noise | always |
| `tapeV` | `uSource` ← tapeH | rgb = **R′G′B′** gamma-encoded, unclamped (the tape path's one YIQ→RGB conversion) | always |
| `signalEncode` | `uSource` ← tapeV | r = S = Y + C, g = Y, b = C (CRT's composite layout; noise term 0) | `connection` = Composite |
| `signalDecode` | `uSource` ← signalEncode | rgb = R′G′B′ gamma, `max(·, 0)` | `connection` = Composite |
| tube passes | linearize ← signalDecode (→ tapeV when off) | as CRT: linear light | `tv` (glow also needs `p_glow > 0`; diffuse also `p_halation > 0 \|\| p_diffusion > 0`: a request to the tube builder) |
| `main` | `uSource` ← linearize, `uGlow` ← glowV, `uDiffuse` ← diffuseUp | canvas | always (last) |

**frame.frag** (includes `resample`, `yiq`, `osd-font`, `osd`). Tape uv → picture uv: `uv = (vUv − 0.5) / vec2(d_pictureW, d_pictureH) + 0.5`; outside [0, 1] → YIQ (0, 0, 0) (bars are black). Otherwise area-filtered sample with footprint `uOutputSize.zw / vec2(d_pictureW, d_pictureH)` through the shared `resample.glsl` (the code lifted from `crt/passes/raster.frag`: bilinear LOD 0 when not minifying, else the 4×4 tent at `log2(widest) − 1`). Then `yiq = rgb2yiq(c)`; if `p_osdMode > 1.5`, `yiq = osdBlend(yiq, osdCamcorder(vUv * uOutputSize.xy), OSD_CAM_RGB)` (it is recorded on tape, so everything after degrades it); then saturation and tint exactly as CRT's raster pass (scale/rotate `yiq.yz`). No colour temperature, no clamp.

**tape-h.frag** (includes `sampling`, `gaussian`, `noise`, `tape-noise`, `timebase`). Declares `uSource, uSourceSize, uFrame, uTime, p_sharpening, d_lumaCutoff, d_chromaSigma, d_chromaDelay, d_lumaNoise, d_chromaNoise`. One loop of 33 taps (`R = 16`):

```
TapeLine t = tapeLine(row);  float D = timebaseShift(t);  float q = x − D;   // source position of this output sample
fcY = d_lumaCutoff, rY = clamp(2/fcY, 3, 16);  fcW = fcY/2, rW = clamp(2/fcW, 3, 16)
noisy = d_lumaNoise > 0 || d_chromaNoise > 0
for k = −16..16:
  s  = textureLod(uSource, vec2((clamp(q + k, 0, W−1) + 0.5) / W, (row + 0.5) / H), 0).rgb   // Y I Q, edge repeat
  hy = lowpassTap(k, fcY, rY)     hw = lowpassTap(k, fcW, rW)     hc = gaussian(k + d_chromaDelay, d_chromaSigma)
  Ly += hy·s.x, Sy += hy;   Lw += hw·s.x, Sw += hw;   C += hc·s.yz, Sc += hc
  if noisy: n = gaussNoise3(vec2(x + k, row) + vec2(17, 31) · float(uFrame % 1024))
            Ny += hy·n.x, Nw += hw·n.x, Qy += hy²;   Nc += hc·n.yz, Qc += hc²
y = Ly/Sy;  w = Lw/Sw;  iq = C/Sc
if noisy:   // white noise through the same filters; its std after the luma filter is exactly d_lumaNoise
  a  = d_lumaNoise / sqrt(Qy)
  st = d_lumaNoise · valueNoise1(x / 24.0, float(row) · 7.13 + float(uFrame % 1024) · 1.618)   // low-frequency streaks
  y += 0.85 · a · Ny + 0.5 · st
  w += 0.85 · a · Nw · Sy / Sw + 0.5 · st      // same normalised-kernel scale as the signal, so peaking sharpens noise too
  iq += d_chromaNoise · Nc / sqrt(Qc)
y += p_sharpening · 2.0 · (y − w)             // SHARPEN_GAIN = 2 (as CRT's RING_GAIN): peaking = halos; 0 = off
vis = clamp(q + 1, 0, 1) · clamp(W − q, 0, 1)  // displaced lines expose black blanking; exactly 1 when D = 0
fragColor = vec4(vec3(y, iq) · vis, 1)
```

Models: luma low-pass + enhancer *(phys.: VHS luma is FM-recorded and band-limited to ≈ 3 MHz at SP; playback enhancers peak around 1.5-2.5 MHz)*; colour-under chroma as a Gaussian with a rightward group delay *(phys.)*; luma noise = band-limited white noise (FM noise is triangular before de-emphasis, roughly flat after it) plus a 24-sample streak component *(approx.)*; chroma noise = white noise through the chroma filter, i.e. streaks about σ long *(phys.)*. White-clipping of enhancer overshoot is not modelled.

**tape-v.frag** (includes `sampling`, `noise`, `yiq`, `tape-noise`, `timebase`, `dropout`, `osd-font`, `osd`). Declares `uSource, uSourceSize, uOutputSize, uFrame, uTime, p_osdMode, d_combW0, d_combW1, d_combW2`. Constants `HS_SNOW_GAIN 0.8, HS_NOISE 0.05, TRACK_SNOW_DENSITY 0.6, TRACK_NOISE 0.08, TRACK_CHROMA_LOSS 0.6, DROPOUT_TAIL_MIX 0.5`. Noise seeds: `vec2(x, row) + vec2(23, 41) · float(uFrame % 1024)` with a distinct constant offset per call.

```
stride = int(d_fieldStride + 0.5);  r1 = max(row − stride, row % stride);  r2 = max(row − 2·stride, row % stride)
c0, c1, c2 = texelFetch(uSource, ivec2(x, row | r1 | r2), 0).rgb      // 3 fetches, same field
yiq = vec3(c0.x, d_combW0·c0.yz + d_combW1·c1.yz + d_combW2·c2.yz)    // 1H comb on chroma only (phys.)
if d_dropoutProb > 0:  Dropout d = dropoutAt(t, x + 0.5)
   yiq.x  = mix(yiq.x, d.level + 0.08 · gaussNoise(...), d.core);   yiq.yz *= 1 − d.core
   yiq    = mix(yiq, c1, d.conceal)                                // DOC substitutes the previous line of this field
   yiq.x  = mix(yiq.x, d.level, DROPOUT_TAIL_MIX · d.tail)
if headSwitchZone(t) > 0 && d_headSwitchNoise > 0:
   e = headSwitchEdge(t)
   yiq.x += d_headSwitchNoise · (HS_SNOW_GAIN · e · snow(x, row, t.seed, 0.5) + HS_NOISE · gaussNoise(...))
if d_tracking > 0:
   b = min(1, trackingBand(t) · (0.6 + 0.8 · hash12(vec2(t.fieldLine, t.seed))))   // ragged lines
   yiq.x  += b · snow(x, row, t.seed + 7, TRACK_SNOW_DENSITY · b) + TRACK_NOISE · b · gaussNoise(...)
   yiq.yz  = yiq.yz · (1 − TRACK_CHROMA_LOSS · b) + TRACK_NOISE · b · gaussNoise2(...)
if abs(p_osdMode − 1) < 0.5:  yiq = osdBlend(yiq, osdVcr(vUv · uOutputSize.xy), OSD_VCR_RGB)   // generated after the heads
fragColor = vec4(yiq2rgb(yiq), 1)
```

Chroma smear model *(phys.)*: NTSC VHS records colour-under with a 90°-per-line phase rotation on one head, so that a 1H comb on playback cancels crosstalk from the neighbouring tracks; the comb averages each field line's chroma with the previous one, halving vertical chroma resolution and moving colour down half a field line. `chromaSmear` 2 is two combs in series. Zone and band noise is added after the comb (a simplification).

**signal-encode.frag** (VHS wrapper). One fetch: `yiq = rgb2yiq(texelFetch(uSource, ivec2(x, row), 0).rgb)`; `phi = subcarrierPhase(x, row, crawlFrame, d_subcarrier, false)` with `crawlFrame = p_crawl > 0.5 ? uVideoFrame % 6 : 0`; `fragColor = compositeModulate(yiq.x, yiq.yz, phi)` = `(Y + C, Y, C, 1)`. No chroma band-limit (the tape already limited chroma to ≤ ~1.5 MHz, below any encoder filter), no noise, no jitter.

**signal-decode.frag** (VHS wrapper). `yiq = compositeDecode(uSource, ivec2(x, row), int(uSourceSize.x), CompositeDecoder(d_subcarrier, d_decodeLumaCutoff, 0.0 /*ringing*/, d_decodeChromaSigma, p_artifacting, p_fringing, crawlFrame, false /*threePhase*/))`; `fragColor = vec4(max(yiq2rgb(yiq), 0.0), 1)`. Same notch and least-squares demodulator as CRT. VHS luma (≤ 3 MHz) has little energy at 3.58 MHz, so rainbowing is mild and dot crawl dominates, which is how VHS composite really looks.

Required from the common-chunk extraction (proposed signatures; if the extraction lands other names the wrappers adapt, the semantics stay):

```glsl
// glsl/common/subcarrier.glsl  (frame = crawl frame, already 0 when crawl is off)
float subcarrierPhase(float x, int line, int frame, float cyclesPerSample, bool threePhase);
// glsl/common/composite-encode.glsl
vec4 compositeModulate(float y, vec2 iq, float phi);          // (y + c, y, c, 1), c = I cos phi + Q sin phi
// glsl/common/composite-decode.glsl  (reads 33 taps of row texel.y; source layout (S, Y, C))
struct CompositeDecoder { float subcarrier; float lumaCutoff; float ringing; float chromaSigma;
                          float artifacting; float fringing; int frame; bool threePhase; };
vec3 compositeDecode(sampler2D src, ivec2 texel, int width, CompositeDecoder d);  // -> Y, I, Q
// glsl/common/resample.glsl
vec3 resampleArea(sampler2D src, vec4 srcSize, vec2 uv, vec2 footUv);  // raster.frag's bilinear / 4x4 tent
```

`chromaSigma` there is the decoder's whole chroma filter (CRT's wrapper passes its per-half `0.0937 / fc`).

**main.frag** (VHS's own; includes `color`, `noise`, `sampling` and the tube's `geometry`, `beam`, `mask`, `post`). Declares what CRT's main declares, plus `p_tv`.
- `p_tv > 0.5` (a uniform branch, so derivatives inside it are fine): CRT main's body unchanged: tube geometry, `crtBeam`, halation, mask, exposure, glow/diffusion, `softClip`, `screenFinish`, `encodeDisplay` + dither. `uSource` is linear light from `linearize`; the tube face is the whole tape frame (`d_tubeW/H` fit `frameAspect`).
- Flat branch (TV off; `uSource` = the gamma R′G′B′ tape raster): `t = (vUv − 0.5) / vec2(d_tubeW, d_tubeH) + 0.5`; outside [0, 1] → black. Inside: 4×4 Mitchell–Netravali upscale (`bcSpline` from the tube beam chunk with B = C = 1/3; Catmull-Rom would add halos on top of the tape's own), taps clamped to the raster, `textureLod` LOD 0. Output `clamp(rgb + ditherOffset(gl_FragCoord.xy), 0, 1)`. **No transfer function** (the tape signal is still in the source's own encoding) and no tube parameter has any effect.

### C4. Chunks (`vhs/glsl/`)

**tape-noise.glsl** needs `noise` (hash12/hash32). No uniforms.
```glsl
float gaussNoise(vec2 p);    // zero mean, unit variance: (hash12(p) + hash12(p + vec2(57.3, 91.1)) − 1) · 2.449 (triangular, as CRT)
vec2  gaussNoise2(vec2 p);
vec3  gaussNoise3(vec2 p);   // per channel, from hash32 pairs
float valueNoise1(float t, float seed);   // knots at integer t: (hash12(vec2(i, seed)) · 2 − 1) · √3 (unit variance),
                                          // smoothstep-interpolated, × 1.2 → ≈ unit rms (approx.)
float snow(float x, float row, float seed, float density);
```
`snow` = FM-threshold "sparkles" *(phys. cause, approx. shape)*: below the FM threshold the demodulator emits clicks, seen as short comet-shaped streaks. Cells of 8 samples per line: `h = hash32(vec2(floor(x / 8) + 0.5, row + seed · 3.1))`; if `h.x >= density` return 0 (so density 0 is exactly 0); `start = cell · 8 + h.y · 4`, `len = 2 + h.z · 6`; `u = (x − start) / len`, outside [0, 1] → 0; return `sign · (1 − u)` with `sign = hash12(h.yz · 53.1) < 0.8 ? 1 : −0.6` (mostly white).

**timebase.glsl** needs `sampling` (PI), `noise`, `tape-noise`; the pass declares `uFrame` and `uTime`. Declares `d_fieldStride, d_jitter, d_wobble, d_topSkew, d_headSwitchLines, d_headSwitchShift, d_headSwitchNoise, d_tracking, d_trackingRoll, d_trackingShift`. All shifts are in samples, **positive = picture moves right** (tapeH samples at `x − shift`).
```glsl
const float FIELD_LINES = 240.0;
const float AFC_TAU_LINES = 8.0;   // receiver horizontal AFC time constant in lines (approx.; consumer sets ~5-20)
struct TapeLine { int row; int fieldLine; int parity; float fieldPos; float seed; };
TapeLine tapeLine(int row);        // stride 2: fieldLine = row / 2, parity = row & 1; stride 1: fieldLine = row, parity = uFrame & 1;
                                   // fieldPos = (fieldLine + 0.5) / 240; seed = float((uFrame % 1024) * 2 + parity)
float jitterShift(TapeLine t);     // d_jitter · valueNoise1(fieldLine / 3.0, seed)
float wobbleShift(TapeLine t);     // d_wobble · (0.65 sin 2π(fieldPos + 0.31 τ) + 0.35 sin 2π(2 fieldPos − 0.73 τ + 0.25)), τ = mod(uTime, 100)
float topSkewShift(TapeLine t);    // d_topSkew · (1 + 0.5 · (hash12(vec2(seed, 3.7)) − 0.5)) · exp(−fieldLine / AFC_TAU_LINES)
float headSwitchZone(TapeLine t);  // 1 when u = fieldLine − (240 − d_headSwitchLines) ≥ 0, else 0 (0 everywhere when lines = 0)
float headSwitchEdge(TapeLine t);  // zone · exp(−u): the switching line itself is the noisy one
float headSwitchShift(TapeLine t); // zone · Δ · exp(−u / AFC_TAU_LINES),
                                   // Δ = d_headSwitchShift · (1 + d_headSwitchNoise · (0.15 · (2·parity − 1) + 0.6 · (hash12(vec2(seed, 9.1)) − 0.5)))
float trackingBand(TapeLine t);    // c = fract(0.3 + d_trackingRoll · uTime); dy = |fract(fieldPos − c + 0.5) − 0.5| (wraps);
                                   // hw = mix(0.05, 0.18, d_tracking); bump = dy < hw ? 0.5 + 0.5 cos(π dy / hw) : 0;
                                   // return clamp(1.6 · d_tracking · bump, 0, 1)
float trackingShift(TapeLine t);   // d_trackingShift · b² · valueNoise1(fieldLine / 1.5, seed + 17), b = trackingBand(t)
float timebaseShift(TapeLine t);   // sum of the five shifts
```
Models: *jitter*: the residual time-base error of a deck without a TBC, correlated over a few lines (phys. cause, approx. spectrum). *Wobble*: slow tape-tension and drum-speed variation bending verticals, as two travelling sinusoids (approx.). *Top skew / flagging*: the receiver's AFC re-locking after the vertical interval, i.e. a first-order loop's exponential settle (phys.). *Head switch*: the two heads' tracks meet a few lines before vertical sync; the new head's timing differs by Δ, so the picture jumps by Δ and the AFC pulls it back with the same τ; the two heads differ slightly (the `parity` term) and the step varies per field with the noise amount (phys. mechanism, approx. magnitudes). Nothing in the zone changes between renders when `d_headSwitchNoise` = 0. *Tracking band*: mistracking lowers the RF envelope over part of each field; where the carrier-to-noise ratio falls below the FM threshold the picture breaks into sparkles and the time base wanders; the band rolls when the control-track phase drifts (phys. mechanism, approx. profile).

**dropout.glsl** needs `noise`, `timebase` (for `TapeLine`). Declares `d_tapeWidth, d_dropoutProb, d_dropoutLen, d_dropoutTail, d_docDelay, d_dropoutEdge`.
```glsl
const float DOC_CONCEAL = 0.85;    // share of the dropout the compensator replaces (approx.)
struct Dropout { float core; float tail; float conceal; float level; };
Dropout dropoutAt(TapeLine t, float x);   // x = sample centre (x + 0.5)
```
Two slots per field line, `j` = 0, 1: `h = hash32(vec2(float(t.fieldLine) + 0.5 + 300·j, t.seed · 1.37 + 5))`; a slot is live when `h.x < d_dropoutProb` (strict, so 0 never fires). `len = d_dropoutLen · (0.4 + 1.2 · h.y)`; `x0 = h.z · (d_tapeWidth + len) − len`; `x1 = x0 + len`; `e = d_dropoutEdge`. `core = smoothstep(x0 − e, x0, x) · (1 − smoothstep(x1 − e, x1, x))`; `tail = x > x1 ? exp(−(x − x1) / d_dropoutTail) : 0`; `conceal = core · DOC_CONCEAL · smoothstep(x0, x0 + d_docDelay, x)`; `level = 0.8 + 0.2 · hash12(h.xy · 91.7)`. Slots combine by `max`. Model *(phys.)*: an oxide defect drops the FM carrier, the limiter then outputs noise that demodulates near white; the VCR's dropout compensator notices after a short delay and substitutes the 1H-delayed line; the demodulator needs a few µs to recover when the carrier returns (the comet tail). A defect wider than the 58 µm track would also hit the neighbouring field; that is not modelled.

**osd-font.glsl** has no uniforms. An original 5×7 dot-matrix set drawn for this project (do not copy any existing font bitmap).
```glsl
const int G_0 = 0; /* … */ const int G_9 = 9;
const int G_A = 10, G_B = 11, G_C = 12, G_D = 13, G_E = 14, G_F = 15, G_G = 16, G_J = 17, G_L = 18, G_M = 19,
          G_N = 20, G_O = 21, G_P = 22, G_R = 23, G_S = 24, G_T = 25, G_U = 26, G_V = 27, G_Y = 28,
          G_COLON = 29, G_PERIOD = 30, G_SLASH = 31, G_PLAY = 32, G_SPACE = -1;
const int GLYPH_COUNT = 33;
const ivec2 FONT[GLYPH_COUNT] = ivec2[GLYPH_COUNT]( /* … */ );
bool glyphDot(int glyph, int col, int row);   // col 0..4 left→right, row 0..6 top→bottom; false outside, for G_SPACE or out-of-range glyphs
```
Packing: each row is 5 bits with **bit 4 = leftmost column**; `.x = row0 | row1 << 5 | row2 << 10 | row3 << 15`, `.y = row4 | row5 << 5 | row6 << 10` (35 bits do not fit one 32-bit int). `glyphDot = (((r < 4 ? .x : .y) >> (r' · 5)) >> (4 − col)) & 1` with `r' = r % 4`. `G_PLAY` is a filled right-pointing triangle. The letters cover `PLAY`, `SP/LP/EP`, every `OSD_MONTHS` entry and `AM/PM`.

**osd.glsl** needs `osd-font`, `yiq`; the pass declares `uTime` and `uOutputSize` (= tape raster size). Declares `p_tapeSpeed, p_osdMonth, p_osdDay, p_osdYear, p_osdHour, d_osdDotW, d_osdDotH, d_osdMarginX, d_osdMarginY`. Does not read `p_osdMode` (the passes decide).
```glsl
const vec3 OSD_VCR_RGB = vec3(0.92);             // VCR character generator: white
const vec3 OSD_CAM_RGB = vec3(1.0, 0.82, 0.3);   // camcorder date stamp: amber
vec2 osdVcr(vec2 px);          // px = vUv · uOutputSize.xy (tape pixels, top-left origin; never gl_FragCoord)
vec2 osdCamcorder(vec2 px);    // both return (text, shadow), each 0 or 1
vec3 osdBlend(vec3 yiq, vec2 hit, vec3 textRgb); // mix(yiq, vec3(0), hit.y · (1 − hit.x)), then mix(…, rgb2yiq(textRgb), hit.x)
```
Text engine: a string is `(id, length)`; `int osdChar(int id, int i)` returns the glyph of character `i`. A string box with top-left `o` covers `(6·len − 1)·dw × 7·dh`; for a pixel, `dot = ivec2(floor((px − o) / vec2(dw, dh)))`, `cell = dot.x / 6`, `col = dot.x % 6` (col 5 is the gap), `text = glyphDot(osdChar(id, cell), col, dot.y)`; `shadow` = the same test at `dot − ivec2(1)` (one dot down-right). Test the box (grown by one dot) first and return early. `W, L` = `uOutputSize.xy`, `mx, my` = margins, `dw, dh` = dot size, `s = int(floor(max(uTime, 0.0)))`.

| string | text | top-left |
|---|---|---|
| VCR state | `PLAY ▶` (P L A Y space ▶, 6) | `(mx, my)` |
| VCR speed | `SP` / `LP` / `EP` from `p_tapeSpeed` (2) | `(W − mx − 11·dw, my)` |
| VCR counter | `H:MM:SS` (7): H = `(s / 3600) % 10`, MM = `(s / 60) % 60`, SS = `s % 60` | `(W − mx − 41·dw, L − my − 7·dh)` |
| Camcorder date | `MMM. DD YYYY` (12): month in `OSD_MONTHS` order, day with leading zero, 4-digit year | `(W − mx − 71·dw, L − my − 17·dh)` |
| Camcorder clock | `HH:MM:SS AM` (11): `c = (int(p_osdHour) · 3600 + s) % 86400`, 12-hour, hour tens digit blank when 0, `AM` before 12:00 | `(W − mx − 65·dw, L − my − 7·dh)` |

Colour space: both passes blend in gamma-encoded YIQ. Camcorder text is drawn in `frame` (then blurred, smeared and noised by the tape); VCR text in `tapeV` (crisp, but still through composite and the TV). The clock does not roll the date over at midnight.

### C5. Presets (`vhs/presets.ts`)

Overrides on the defaults; `home-sp` comes first, it is what a new user gets. Tube ids come from the shared builder; `MASK` from wherever the extraction exports it.

| id | label | values |
|---|---|---|
| `home-sp` | Home recording (SP) | `{}` |
| `rental` | Worn rental | `generation: 1, saturation: 0.9, sharpening: 0.45, chromaSmear: 1.3, lumaNoise: 0.3, chromaNoise: 0.4, lineJitter: 0.5, wobble: 1, topSkew: 3, headSwitch: 7, headSwitchNoise: 0.6, dropouts: 0.5, dropoutLength: 12, tracking: 0.12, trackingRoll: 0.03` |
| `ep` | Six-hour EP | `tapeSpeed: TAPE_SPEED.ep, saturation: 0.9, chromaSmear: 1.2, lumaNoise: 0.2, chromaNoise: 0.25, lineJitter: 0.35, wobble: 0.6, dropouts: 0.08` |
| `camcorder` | Camcorder (date stamp) | `osdMode: OSD_MODE.camcorder, saturation: 1.1, sharpening: 0.5, lumaNoise: 0.2, chromaNoise: 0.25, lineJitter: 0.15, wobble: 0.2, topSkew: 1, headSwitch: 4` |
| `vcr-tv` | VCR on a TV | `tv: 1, osdMode: OSD_MODE.vcr, tapeLines: 0, headSwitch: 0` (the TV's overscan hides it), `topSkew: 1, maskType: MASK.shadow, maskTVL: 300, maskStrength: 0.35, beamMin: 0.22, beamMax: 0.42, beamShape: 2, curvatureX: 0.04, curvatureY: 0.05, cornerRadius: 0.04, vignette: 0.3, glow: 0.15, diffusion: 0.08, halation: 0.08, persistence: 0.25, convergenceR: 0.5, convergenceB: -0.5, crtGamma: 2.5` |
| `dub` | Third-generation dub | `generation: 2, saturation: 0.85, sharpening: 0.55, chromaSmear: 1.5, lumaNoise: 0.15, chromaNoise: 0.2, lineJitter: 0.3, wobble: 0.6, topSkew: 2, dropouts: 0.1` (derive turns this into ×3 chroma delay, ×0.8 bandwidth, ×√3 noise) |
| `tracking` | Bad tracking | `tracking: 0.75, trackingRoll: 0.12, lineJitter: 0.8, wobble: 1.5, topSkew: 4, headSwitch: 8, headSwitchNoise: 0.8, dropouts: 0.6, lumaNoise: 0.3, chromaNoise: 0.4` |

Every value must pass `presetProblems` (the definitions test checks this).

### C6. Performance budget

Texture fetches per output texel (ALU is cheap next to these; the tape raster is at most 854×480 ≈ 0.4 Mpx):

| pass | size | max fetches | skipped when |
|---|---|---|---|
| frame | tape | 16 (4×4 tent; 1 when not minifying) | never |
| tapeH | tape | 33 (+ 33 hash32 when either noise > 0) | never |
| tapeV | tape | 3 | never |
| signalEncode | tape | 1 | `connection` = Y/C |
| signalDecode | tape | 33 | `connection` = Y/C |
| linearize | tape | 2 | `tv` off |
| glowH / glowV | ≤ 800 × tape lines | as CRT | `tv` off or `glow` = 0 |
| diffuseDown / diffuseUp | viewport / 8 | as CRT | `tv` off or `halation` = `diffusion` = 0 |
| main | viewport | flat 16; TV 20 (as CRT) | never |

The default configuration (composite, TV off) runs frame, tapeH, tapeV, signalEncode, signalDecode and main: about 86 fetches per tape texel plus 16 per screen pixel. The OSD returns early outside its string boxes; dropout, band and zone code is skipped by its `d_` gate.

### C7. Decisions taken in this contract (changes from the design above)

- `tapeV` outputs gamma R′G′B′, not YIQ, so the composite encoder, `linearize` and the flat `main` all read one format whichever passes are disabled.
- VHS's `signalEncode` only modulates (one tap); the shared code it needs is listed in C3 as proposed signatures.
- Keep-aspect widens the line duration instead of squeezing the picture into 52.6 µs, so artifacts are the same size per picture height in every fit mode. With the TV on, the tube takes the frame's aspect (a 16:9 source in "keep" gives a 16:9 tube).
- Added `osdHour` (clock start). The head-switch step is a constant (1.5 µs), not a parameter.
- Generation loss narrows bandwidth by the cascade formula for 3rd-order filters, not by 1/√n.
- In 480-row mode the two fields are interleaved rows with separate time-base errors (combing on motion).
- Dropouts are seeded per render (the simulated tape runs at the display's field rate), not locked to the video frame.

## Changes after review

The code is the reference where it differs from the contract above. What changed during implementation and review:

- **One engine change after all:** `uTime` is now the media position in both playback modes. A restarted transcode stream has timestamps from 0, so `EffectRenderer` adds the plan's start offset (`mediaPosition` in `gl/renderPolicy.ts`); without it the OSD counter and clock reset on every seek.
- **Seeds:** the VHS passes no longer use `uFrame % 1024` (a 17-second loop at 60 Hz, visible as recurring dropouts). `renderSeed*` in `vhs/glsl/tape-noise.glsl` hashes the render counter instead.
- **Subcarrier phase** in 480-row mode follows field lines (`vhs/glsl/tape-phase.glsl`), so the composite output crawls instead of showing a static two-row checkerboard. The shared decoder takes the phase line as an argument; CRT passes its row, unchanged.
- **Chroma delay** is clamped in `derive.ts` so the delayed Gaussian stays inside tapeH's 33 taps (`|delay| + 2.5σ ≤ 16`).
- **Camcorder stamp** is drawn over letterbox and pillarbox bars, and `osdDotW` shrinks on narrow (portrait) tape rasters so the date line fits.
- **`tapeLines` 240** is one tape row per field line; nothing alternates between fields (C1's "one field per render" note overpromised).
- **Shared names** differ from C3's proposals: `areaSample`, `compositeEncode`, `compositeAccumulate` / `compositeLumaPath` / `compositeDecodeYiq`, `tubeDisplay`, `tubePasses(source, { rasterSize, enabled })`, plus `glsl/common/filter-radius.glsl`.
- **Luma noise** figures are before the enhancer; default sharpening raises the visible noise by about 1.33×.
- **`precision highp int`** is required in every pass that divides or takes `%` of ints (Mesa's AMD compiler crashed on mediump int division).
- **Presets:** `rental` and `ep` were retuned against real footage (see `presets.ts`).
- **Not done:** CRT's `noise3` and VHS's `gaussNoise3` stay separate because they differ in the last digits of one constant and sharing would change CRT output; the hidden TV "Static noise" parameter keeps the render loop at display rate even with the TV stage off.
