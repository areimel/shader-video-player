# Shader Video Player

Desktop video player (Electron) that draws the video through multi-pass WebGL2 shader effects. CRT television is the first effect; VHS is planned. Personal daily-use player, Linux/Wayland first.

Design spec (read before changing the shader layer): `docs/superpowers/specs/2026-11-15-shader-video-player-design.md`.

## Commands

```bash
pnpm dev            # vite + esbuild watch + Electron
pnpm typecheck      # renderer/tests and electron tsconfigs
pnpm test           # vitest (pure logic only, no GL)
pnpm check:shaders  # compiles every effect pass in a hidden Electron window
pnpm build          # typecheck + renderer bundle + main bundle
pnpm dist           # .deb in release/
```

Run `pnpm typecheck && pnpm test && pnpm check:shaders` before every commit. Test clips live in `fixtures/` (gitignored); regenerate them with ffmpeg `lavfi` sources.

## Layout

```
electron/            main process: window, menu, ipc, svp-media:// protocol, gpuFlags
electron/media/      ffprobe + ffmpeg sessions (remux/transcode to fragmented MP4)
shared/types.ts      IPC contract (PlayerBridge) shared by main, preload and renderer
renderer/            React UI: components/, hooks/, styles/, utils/
renderer/shader/gl/  WebGL2 engine: context, program, target, includes, passGraph, videoSource
renderer/shader/glsl/common/   shared GLSL chunks (#include "color", "yiq", ...)
renderer/shader/effects/       types.ts, params.ts (generic helpers), registry.ts
renderer/shader/effects/crt/   params, presets, derive, pipeline, passes/*.frag, glsl/*.glsl
tests/               vitest
```

## Rules

- **One source of truth per parameter.** An effect parameter is declared once in `effects/<effect>/params.ts` as a `ParamSpec`. Uniforms (`p_<id>`), the settings panel, presets, persistence and reset are all generated from that table. Never hand-write a slider or a uniform upload for a parameter.
- **Derived values live in `derive.ts`** (pure, unit-tested) and reach shaders as `d_<name>`. If a shader assumes something about a derived value (e.g. mask transmittance), keep the two in step and say so in a comment.
- **Shader contract:** GLSL ES 3.00, `vUv` origin top-left, `out vec4 fragColor`, `#include "name"` for shared chunks, every uniform a float except samplers, `uFrame` (per render: noise seeds) and `uVideoFrame` (per presented video frame: dot crawl, bob). Passes before the final one work in tube space at raster resolution; only the last pass runs at screen resolution.
- **Shader licensing:** this repo is MIT. Do not paste code from GPL/LGPL shaders (CRT-Royale, CRT-Guest-Advanced, CRT-Geom, Easymode, zfast, Themaister/NTSC-Adaptive, blargg, Patchy NTSC). Permissive sources may be adapted with a credit in the file and in `THIRD_PARTY_NOTICES.md`.
- **Effect off means off.** With no effect selected the plain `<video>` is shown and no GL work happens. Don't add per-frame work to the bypass path.
- **DRY:** reuse `renderer/components/common/*` (Slider, Dropdown, IconButton, Toast) and existing hooks before writing new ones; extract a shared piece once something appears three times.
- **File size:** keep files under ~300 lines; split by responsibility when they grow.
- **Security:** renderer stays sandboxed with context isolation. The page never sends file paths for drops: the preload resolves real `File` objects to paths itself. Files are served over `svp-media://` only after the main process has probed and allowlisted them. New IPC goes through `shared/types.ts` → `preload.ts` → `ipc.ts` and validates its arguments in the main process.
- **Media:** system `ffmpeg`/`ffprobe` from `PATH` (override with `SVP_FFMPEG_PATH` / `SVP_FFPROBE_PATH`). Nothing is bundled.

## Adding an effect

1. Create `renderer/shader/effects/<id>/` with `params.ts`, `presets.ts`, `derive.ts`, `pipeline.ts`, `passes/*.frag`, and an `index.ts` exporting an `EffectDefinition`.
2. Add it to `effects/registry.ts`. The panel, persistence and shortcuts pick it up from there.
3. Add tests for `derive.ts` and preset validity; `pnpm check:shaders` covers compilation.

## Commits

Small, descriptive checkpoints: imperative subject line, body listing what changed and why. One workstream per commit.
