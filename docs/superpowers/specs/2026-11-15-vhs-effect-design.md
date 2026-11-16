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
