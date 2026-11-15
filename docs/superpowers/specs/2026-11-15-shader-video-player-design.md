# Shader Video Player — design

Date: 2026-11-15. Status: approved.

## Intent

A VLC-style desktop video player for Alec's own daily use whose distinguishing feature is live shader filters over the video. The CRT television effect comes first; VHS follows later. Reliable playback matters as much as the effect.

## Goals

- Plays the files a daily player meets (MP4, MKV, WebM, AVI, HEVC, AC3 audio) on Linux/Wayland.
- CRT effect that is authentic and tweakable: physically inspired pipeline, four presets, one control per parameter.
- Effect can be switched off instantly without interrupting playback.
- Adding a second effect (VHS) means adding a folder, not changing the engine.
- Small files (under ~300–400 lines), one source of truth per concept.

## Non-goals (this build)

VHS effect, HDR output, WebGPU, Windows/macOS packaging, media library, mpv fallback.

## Anti-goals

- Copying GPL shader code (CRT-Royale, Guest-Advanced, CRT-Geom, zfast, Easymode, Patchy NTSC, Themaister/NTSC-Adaptive) into this MIT repo. Their ideas may be reimplemented; their code may not be pasted.
- A shader layer that degrades normal playback when off.

## Approaches considered

1. **Electron/web player + WebGL2 shaders (chosen).** Starts with the tools already installed; multi-pass effects and live sliders are easy. Cost: only Chromium's decoders, mitigated by ffmpeg remux/transcode.
2. **mpv-based native player.** Plays everything and has GLSL hooks, but needs native toolchains, a hard-to-customise UI and limited shader controls.
3. **Electron UI around embedded mpv.** Best format support, but embedding is fragile on Wayland and the most work.

Base: `babu-studios/babu-video-player` (MIT) copied whole at commit `1b33fd2`, chosen over a fresh electron-vite scaffold because it already has seekable local-file serving, ffprobe/ffmpeg fallback, subtitles extraction and a small clean React UI.

## Architecture

```
<video> (decoder, in DOM)  ──requestVideoFrameCallback──▶ video texture
                                                            │
                                         PassGraph (WebGL2, per effect)
                                                            │
                                                   <canvas> (visible)
                              subtitles overlay + controls sit above the canvas
```

- **Bypass:** with the effect off the `<video>` is shown directly and the GL loop is stopped.
- **Frame timing:** rVFC uploads the frame and marks dirty; rAF renders only when dirty or when an animated parameter is non-zero. Nothing runs while paused, except one render on seek, resize or parameter change.
- **Colour:** the uploaded texture is gamma-encoded RGB. Signal passes stay gamma-encoded (the analog signal carries gamma-corrected voltages). Linearize afterwards, work in linear RGBA16F, encode for the display and dither in the last pass.
- **Sizing:** the canvas backing store is sized in device pixels (`ResizeObserver` with `devicePixelContentBoxSize`). The phosphor mask is computed from `gl_FragCoord` in unwarped integer device pixels.
- **Feedback buffers** are cleared on seek, source change and resize.

### Process layout (inherited)

`electron/` main process (window, menu, IPC, `svp-media://` protocol, ffprobe/ffmpeg sessions), `renderer/` React UI, `shared/types.ts` the IPC contract, `tests/` vitest.

### Shader layer (`renderer/shader/`)

```
gl/           context  program  shaderError  target  quad  includes  commonChunks
              passTypes  passPlan  passGraph  videoSource  renderPolicy  effectRenderer
glsl/common/  color.glsl  yiq.glsl  gaussian.glsl  sampling.glsl  noise.glsl
effects/
  types.ts  registry.ts
  crt/  params.ts  presets.ts  derive.ts  pipeline.ts  passes/*.frag  glsl/*.glsl
```

## Contracts (binding for all workstreams)

### GLSL

- GLSL ES 3.00. Each `.frag` starts with `#version 300 es` and `precision highp float;`.
- The shared vertex shader draws one fullscreen triangle and provides `in vec2 vUv;` with (0,0) at the **top-left** of the image. Fragment output is `out vec4 fragColor;`.
- Shared code is pulled in with `#include "name"` on its own line; names resolve to `glsl/common/<name>.glsl` or the effect's `glsl/<name>.glsl`. Includes are resolved in TypeScript before compiling; nesting is allowed, each chunk is included once.
- Shader files are imported as strings with Vite `?raw`.

### Uniforms

- Samplers are named by the pass's `inputs` map, e.g. `uSource`. For every sampler `uX` the engine also sets `uXSize` = `vec4(width, height, 1/width, 1/height)` if the shader declares it.
- Engine uniforms, set when declared: `uOutputSize` (vec4, this pass's target), `uViewportSize` (vec4, canvas device pixels), `uVideoSize` (vec4, decoded video), `uTime` (float, media time in seconds), `uFrame` (int, rendered frame counter: per-render noise and jitter seeds), `uVideoFrame` (int, presented video frame counter, also advanced by a seek: subcarrier crawl phase and bob interlace, which must not change when the same video frame is re-rendered), `uDeltaTime` (float, seconds since the previous render, clamped to 0.1).
- Parameter uniforms are `float` named `p_<paramId>` (e.g. `p_maskStrength`). Enumerations and toggles are passed as floats holding the option index or 0/1. Values computed in TypeScript rather than set by the user are `d_<name>` (e.g. `d_virtualLines`, `d_maskWidth`, `d_exposure`) and come from `derive.ts`.
- Unknown or unused uniforms are ignored silently, so every pass can be handed the full parameter set.

### TypeScript

```ts
// gl/passGraph.ts
type SourceRef = "video" | string;            // pass id, or "<passId>:prev" for last frame's output
interface Size { width: number; height: number }
interface SizeEnv { viewport: Size; video: Size; values: Record<string, number> }  // values = params + derived
interface PassSpec {
  id: string;
  frag: string;                                // raw source, includes not yet resolved
  inputs: Record<string, SourceRef>;           // sampler uniform name -> source
  size: "viewport" | ((env: SizeEnv) => Size); // last pass renders to the canvas
  format?: "rgba16f" | "rgba8";                // default rgba16f (falls back to rgba8 when unsupported, unless the effect has requiresFloat)
  filter?: "linear" | "nearest";               // default linear
  mipmapInputs?: boolean;                      // generate mipmaps on the video texture before this pass
  feedback?: boolean;                          // keep previous frame's output for "<id>:prev"
  enabled?: (values: Record<string, number>) => boolean; // disabled passes forward their first input
}

// effects/types.ts
type ParamKind = "range" | "select" | "toggle";
interface ParamSpec {
  id: string; label: string; group: string; kind: ParamKind;
  min?: number; max?: number; step?: number; default: number;
  options?: string[];                          // select: value is the option index
  unit?: string; animated?: boolean;           // animated: non-zero value keeps the render loop running
  hint?: string;
}
interface Preset { id: string; label: string; values: Partial<Record<string, number>> }
interface EffectDefinition {
  id: string; label: string;
  params: ParamSpec[]; groups: string[]; presets: Preset[];
  derive(values: Record<string, number>, env: { viewport: Size; video: Size }): Record<string, number>;
  passes: PassSpec[];
  chunks: Record<string, string>;              // effect-local #include chunks
  requiresFloat?: boolean;                     // refuse to start without float render targets
}
```

`ParamSpec` is the single source of truth: uniforms, the settings panel, preset validation, persistence and reset all read it. A parameter id appears once in TypeScript (in `params.ts`) and in the shaders that use it.

## CRT effect

| Pass id | Size | Purpose |
|---|---|---|
| `raster` | H × V virtual raster | Area-filtered downsample of the video to V lines × H samples; tube aspect / content fit / overscan; saturation, tint, colour temperature |
| `signalEncode` | H × V | RGB → YIQ; in composite mode modulate chroma onto the subcarrier and form the composite signal; add signal noise and line jitter |
| `signalDecode` | H × V | Demodulate and low-pass luma/chroma (FIR); artifacting, fringing, ringing, chroma delay; back to gamma RGB. RGB mode = horizontal low-pass only; S-video = separate Y/C limits |
| `linearize` | H × V, feedback | `pow(c, crtGamma)` then per-channel phosphor persistence against last frame |
| `glowH`, `glowV` | min(H, 800) × V | Separable Gaussian for glow and halation |
| `diffuseDown`, `diffuseUp` | ⅛ viewport | Wide unmasked diffusion (dual-filter blur) |
| `main` | viewport | Curvature, convergence, horizontal reconstruction, per-channel beam across 3 lines, phosphor mask, exposure compensation, add glow/halation/diffusion, then post: corners, vignette, reflection, noise, flicker, hum bar, display gamma, dither |

- Virtual lines "auto" picks the largest of 240 / 288 / 480 / 576 giving at least 3.5 output pixels per line; scanline strength fades to zero between 2.5 and 2.0 pixels per line.
- Mask width "auto" = round(viewportWidth / (TVL × 4/3 tube-width fraction)) snapped to 2, 3, 4 or 6 px.
- Exposure compensation = 1 / (mask transmittance × beam duty), scaled by the `autoExposure` amount and soft-clipped.
- Presets: Consumer Composite TV, Trinitron (S-video), Arcade Monitor (RGB slot mask), PVM (RGB, fine grille).

Permissive sources we may adapt, each credited in `THIRD_PARTY_NOTICES.md`: Lottes CRT / CRTS (public domain), crt-beans (MIT), CRT-Hyllian (MIT), MAME HLSL (BSD-3-Clause), newpixie-crt (MIT), Cathode Retro (MIT/BSL-1.0), newomp4/phosphor (MIT).

## Player changes

- Linux port: `.deb` packaging, native title bar, `libx264` (optionally VAAPI) for transcodes, system `ffmpeg`/`ffprobe` from `PATH` (override with `SVP_FFMPEG_PATH` / `SVP_FFPROBE_PATH`), hardware-decode switches in one module.
- `svp-media://` gains CORS so WebGL may sample the video.
- External subtitle files (`.srt`, `.vtt`; sibling file auto-detected). Subtitles render above the canvas, not through the effect.
- Simple play queue: open or drop several files, next/previous, auto-advance.
- Effects panel generated from `ParamSpec`, preset picker, reset, persisted settings, shortcuts.

## Testing

- Vitest for pure logic: include resolver, pass-graph sizing/ordering, `derive.ts`, preset validation, ffmpeg argument builders, subtitle parsing, queue.
- Shader smoke tests in a real Electron window: every pass compiles; a fixed test pattern through each preset produces a non-blank, deterministic frame.
- Manual verification with ffmpeg-generated fixtures (SMPTE bars, `testsrc2`, HEVC MKV with AC3, 4K).

## Left to the builder

Exact filter kernels and tap counts, panel styling, shortcut keys, how the queue is displayed, golden-image tolerance.

## Settled details (from the builder review)

- **Playback path** is inherited from the base: ffprobe every file; play natively when the container and codecs are ones Chromium decodes, otherwise ffmpeg remuxes (video copied) or transcodes (libx264) live into a growing fragmented MP4 that is streamed to the `<video>`. Seeking in that mode restarts ffmpeg at the target time. Either way the `<video>` element is the frame source for the shader layer.
- **Feedback inputs** (`<id>:prev`) are black on the first frame and after every reset.
- **Disabled passes** are skipped; readers receive the disabled pass's first input, whatever its size.
- **RGBA16F support** is probed at runtime by building a real framebuffer. A pass without an explicit `format` falls back to RGBA8 when it is missing, but an effect that stores signed or >1 values declares `requiresFloat` (`EffectDefinition`, CRT sets it) and then fails at init with "This effect needs floating-point render targets, which this GPU/driver does not provide" through the normal error path (effect off, toast).
- **Performance target:** smooth 1080p playback with every CRT pass on this machine's GPU; 4K is best effort. There is no automatic quality degradation; the user lowers settings.
- **Settings persistence:** renderer `localStorage`, one entry per effect holding the active preset id and the full parameter values, plus which effect is active. Built-in presets only; changing any control marks the state "Custom".
- **Acceptance for the CRT look:** every pass compiles on a real GPU (`pnpm check:shaders`), each preset renders a non-blank frame from test patterns, and the result is judged by eye against real footage. Preset values are starting points to be tuned.
- **Derived-value keys** returned by `derive()` are unprefixed; the engine adds `d_` (and `p_` for parameters).
