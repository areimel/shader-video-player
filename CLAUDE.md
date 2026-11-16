# Shader Video Player

Desktop video player (Electron) that draws the video through multi-pass WebGL2 shader effects. CRT television is the first effect; VHS is planned. Personal daily-use player, Linux/Wayland first.

Design spec (read before changing the shader layer): `docs/superpowers/specs/2026-11-15-shader-video-player-design.md`.

## Commands

```bash
pnpm dev            # vite + esbuild watch + Electron
pnpm typecheck      # renderer/tests and electron tsconfigs
pnpm test           # vitest (pure logic only, no GL)
pnpm check:shaders  # compiles every effect pass on the real GPU in a hidden Electron window
pnpm build          # typecheck + renderer bundle + main bundle
pnpm dist           # .deb in release/
```

Run `pnpm typecheck && pnpm test && pnpm check:shaders` before every commit, and check the exit status itself: piping a gate through `tail`/`grep` hides a failure.

Stack: Electron 45, React 19, TypeScript 7 (strict), Vite 8, esbuild for the main process, vitest, pnpm 11. Build-script approval for dependencies lives in `pnpm-workspace.yaml` (`allowBuilds`).

## Layout

```
electron/                 main process
  main.ts window.ts menu.ts gpuFlags.ts powerSave.ts recents.ts
  ipc.ts subtitleIpc.ts preload.ts     IPC surface
  protocol.ts allowlist.ts             svp-media:// (file + stream), the one servable file
  playback.ts selection.ts queue.ts    open/restart with a generation counter; queue allow-set
  devCapture.ts                        screenshot harness (dev only)
  media/                               probe, formats, ffmpegArgs, session (transcode),
                                       subtitles, externalSubtitles, processes, binaries
shared/                   types.ts (PlayerBridge IPC contract), subtitleFiles.ts, superseded.ts
renderer/
  App.tsx                 thin composition; keep it that way
  components/             Controls, VideoView, ShaderCanvas, SubtitleOverlay, QueuePanel, ...
  components/common/      Slider, Dropdown, IconButton, Icon, Toast
  components/effects/     EffectsPanel, PresetPicker, ParamGroup, ParamControl, Switch
  hooks/                  usePlaybackSource, usePlayQueue, usePlayerState, usePlayerShortcuts,
                          useSubtitles, useEffectSettings, useEffectChain, ...
  utils/                  queue (reducer), effectSettings (reducer), effectStorage, cueText, step
  shader/gl/              context, program, shaderError, target, quad, includes, commonChunks,
                          passTypes, passPlan (pure), passGraph, videoSource, renderPolicy (pure),
                          effectRenderer
  shader/glsl/common/     color, yiq, noise, gaussian, sampling, subcarrier, composite-encode,
                          composite-decode  (#include "name"; pure, no p_/d_ names)
  shader/effects/shared/  signal.ts (NTSC timing: subcarrier and cutoff cycles per sample)
  shader/effects/         types.ts, params.ts (generic helpers), registry.ts
  shader/effects/crt/     params, presets, derive, pipeline, index, passes/*.frag, glsl/*.glsl
tests/                    vitest; tests/shaders/compile-entry.ts is the check:shaders entry
scripts/                  dev.mjs, build-electron.mjs, check-shaders.mjs (+ -main.cjs)
```

## How it fits together

- **Playback:** ffprobe every file. Native when Chromium can decode it; otherwise ffmpeg remuxes or transcodes live into a growing fragmented MP4 served at `svp-media://stream/<id>`. Seeking or switching audio in that mode restarts ffmpeg (`restartStream`).
- **Effect on:** the `<video>` stays in the DOM but hidden (`.video-hidden`, never `display:none`), `VideoSource` uploads frames on `requestVideoFrameCallback`, `PassGraph` runs the effect's passes, the last pass draws to the canvas. `EffectRenderer` renders only when a frame, parameter or size changed, or while an `animated` parameter is non-zero during playback.
- **Effect off:** the plain `<video>` is shown, the canvas is unmounted and its WebGL context released.
- **CRT pipeline:** `raster → signalEncode → signalDecode → linearize (feedback) → glowH → glowV → diffuseDown → diffuseUp → main`. Everything before `main` is in tube space at raster resolution.
- **Settings:** `localStorage` keys `svp.effect.active` and `svp.effect.<id>`; loaded through `resolveValues`, so stale or out-of-range values heal. First run: CRT's first preset is selected but the effect is off.
- **Subtitles** are always drawn by `SubtitleOverlay` (track kept in `hidden` mode) so they look the same with the effect on or off.

## Rules

- **One source of truth per parameter.** An effect parameter is declared once in `effects/<effect>/params.ts` as a `ParamSpec`. Uniforms (`p_<id>`), the settings panel, presets, persistence and reset are all generated from that table. Never hand-write a slider or a uniform upload for a parameter. Select option order is part of the shader contract (see the index constants in `crt/params.ts`).
- **Derived values live in `derive.ts`** (pure, unit-tested) and reach shaders as `d_<name>`; the engine adds the `p_`/`d_` prefixes. Where a shader and `derive.ts` share an assumption, keep them in step and say so in a comment. Current pairs: mask transmittance (`mask.glsl` ↔ `maskTransmittance`), peak-1 beams with duty σ√(2π) (`beam.glsl` ↔ `exposureGain`), and `BEAM_SIGMA_MAX = 0.55` (the three-line beam sum is only accurate up to that width).
- **Shader contract:** GLSL ES 3.00, `vUv` origin top-left, `out vec4 fragColor`, `#include "name"` for shared chunks, every uniform a float except samplers, `uFrame` (per render: noise seeds) and `uVideoFrame` (per presented video frame: dot crawl, bob). A uniform used by several chunks is declared once. `gl_FragCoord` is bottom-left origin in every pass; only use it where origin does not matter (mask, noise, dither). Use `textureLod` wherever derivatives are undefined (after an early return, inside loops with `break`).
- **Float targets:** an effect that stores signed or >1 values sets `requiresFloat`; it then refuses to start on a GPU without float render targets instead of rendering garbage.
- **Shader licensing:** this repo is MIT. Do not paste code from GPL/LGPL shaders (CRT-Royale, CRT-Guest-Advanced, CRT-Geom, Easymode, zfast, Themaister/NTSC-Adaptive, blargg, Patchy NTSC). Permissive sources may be adapted with a credit in the file and in `THIRD_PARTY_NOTICES.md`.
- **Effect off means off.** Don't add per-frame work to the bypass path.
- **DRY:** reuse `renderer/components/common/*` and existing hooks before writing new ones; extract a shared piece once something appears three times. Pure state logic goes in a reducer-style module under `utils/` with tests; hooks stay thin.
- **File size:** keep files under ~300 lines; split by responsibility when they grow.
- **Media:** system `ffmpeg`/`ffprobe` from `PATH` (override with `SVP_FFMPEG_PATH` / `SVP_FFPROBE_PATH`). Nothing is bundled. All ffmpeg/ffprobe inputs carry `INPUT_PROTOCOLS` (`-protocol_whitelist`) so a playlist-format file cannot make ffmpeg fetch URLs.

## Security model

The renderer is sandboxed with context isolation and is treated as untrusted.

- **Drops:** the page passes `File` objects; the preload resolves them to paths (`webUtils.getPathForFile`). The page never supplies a path string for a drop.
- **What can be opened:** `probe.ts` rejects anything that is not real video (images, `*_pipe`, playlist/network formats, no video stream, zero duration).
- **What can be served:** `allowlist.ts` holds only the one native file on screen. Transcodes are served by session id and never allowlist a path. `serveFile` uses the realpath it checked.
- **Queue:** `openQueued` only accepts paths the main process handed out for the current user selection (`queue.ts`), committed after an item actually opens.
- **Subtitles:** the renderer holds opaque ids; the main process approves files (picked, dropped, or siblings of the open video), checks extension and size, and converts with a forced demuxer.
- **New IPC** goes `shared/types.ts` → `preload.ts` → `ipc.ts` and validates every argument in the main process.

## Concurrency rules

These came out of code review of the queue and transcode paths.

- Opens and restarts are superseded, not queued: `playback.ts` bumps a generation counter and a stale request throws `supersededError()` (`shared/superseded.ts`). Callers must treat `isSuperseded(e)` as "ignore silently": no toast, no state change.
- After any `await` in the main process, re-check the generation before using module-level state.
- In the renderer only the latest request may set the plan or the loading flag (`usePlaybackSource`).
- Auto-advance happens only when no load is in flight and the playhead is really at the end (`reachedEnd`): disposing a transcode session also fires `ended` on the old element.
- Kill child processes you supersede (stream sessions, subtitle extraction).

## Verifying rendering without a person

`electron/devCapture.ts` (disabled in packaged builds) screenshots the window and quits:

```bash
pnpm exec vite build && pnpm build:electron
SVP_CAPTURE=/tmp/out.png SVP_CAPTURE_SIZE=1920x1080 SVP_CAPTURE_DELAY=6000 \
SVP_CAPTURE_KEYS=shift+E SVP_CAPTURE_EVAL='document.querySelector("canvas")?.width' \
  pnpm exec electron --no-sandbox . "$PWD/fixtures/clip.mp4"
```

- `SVP_CAPTURE_KEYS` presses keys one second after load (`e`, `n`, `shift+E`, `ArrowRight`, …); `SVP_CAPTURE_EVAL` logs the result of a page expression as `[eval] …`; renderer console output is echoed.
- Effect state persists between runs, so `e` toggles whatever the last run left. Set state explicitly with an `SVP_CAPTURE_EVAL` that writes or clears `localStorage` in a short first run.
- Scanlines fade out below 2.5 output pixels per line by design; capture at 1080p or larger to see them, and crop/zoom with ffmpeg to inspect the mask.
- Manual launches need `--no-sandbox` in dev because the npm-installed `chrome-sandbox` is not setuid; `pnpm dev` adds it automatically. The packaged `.deb` is meant to run sandboxed.
- Test clips live in `fixtures/` (gitignored). Regenerate with ffmpeg `lavfi` sources, e.g. `smptebars`, `testsrc`, `testsrc2`, `mandelbrot` (mid-tones), plus an HEVC+AC3 MKV to exercise the transcode path and a same-named `.srt` for subtitles.

## Adding an effect

1. Create `renderer/shader/effects/<id>/` with `params.ts`, `presets.ts`, `derive.ts`, `pipeline.ts`, `passes/*.frag`, and an `index.ts` exporting an `EffectDefinition` (set `requiresFloat` if needed).
2. Add it to `effects/registry.ts`. The panel, persistence and shortcuts pick it up from there.
3. Add tests for `derive.ts` and preset validity (see `tests/effects/crt.test.ts`, which also checks that shaders only use known `p_`/`d_` names); `pnpm check:shaders` covers compilation.

For VHS, reuse the composite signal code instead of copying it: `glsl/common/subcarrier`, `composite-encode` and `composite-decode` (pure functions; the CRT `signal-encode/decode.frag` passes are thin wrappers that supply the `p_`/`d_` values) and `effects/shared/signal.ts` for the frequencies. An effect chunk with the same name as a common chunk silently shadows it (`tests/effects/chunks.test.ts` guards this).

## Known gaps

- Preset values were tuned against synthetic test patterns only; they need a pass against real footage.
- Not yet exercised interactively: slider dragging, drag-and-drop, file dialogs, fullscreen, context-loss recovery, the installed `.deb`.
- Not measured: 4K frame time, whether hardware video decode engages (`chrome://gpu`).
- The horizontal filter in `beam.glsl` does not widen when the raster is minified (windows narrower than the raster width may alias).
- Phosphor persistence treats a re-render of the same paused frame as a new frame.
- No HDR, no image-based subtitles (PGS/VobSub), ASS styling is dropped on conversion.

## Commits

Small, descriptive checkpoints: imperative subject line, body listing what changed and why. One workstream per commit, and each commit should pass the gates on its own.
