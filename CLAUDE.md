# Shader Video Player

Desktop video player (Electron) that draws the video through multi-pass WebGL2 shader effects. Two effects: CRT television (`crt/`, first in the registry) and VHS tape (`vhs/`), both built on `effects/shared/`. Personal daily-use player, Linux/Wayland first.

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
  screenshot.ts pngName.ts             save-PNG dialog and IPC; validates the PNG and file name
  media/                               probe, formats, ffmpegArgs, session (transcode),
                                       subtitles, externalSubtitles, processes, binaries
shared/                   types.ts (PlayerBridge IPC contract), subtitleFiles.ts, superseded.ts
  commands.ts             every command: id, label, group, keys, accelerator (single source)
renderer/
  App.tsx                 thin composition; keep it that way
  components/             Controls, VideoView, ShaderCanvas, SubtitleOverlay, QueuePanel, ...
  components/common/      Button, Panel (+PanelHeader), Kbd, Segmented, Switch, Slider, Dropdown,
                          IconButton, Icon, Toast
  components/effects/     EffectsPanel, PresetPicker, ParamGroup, ParamControl
  styles/tokens.css       colour, type, spacing, radius, layer and focus tokens
  hooks/                  usePlaybackSource, usePlayQueue, usePlayerState, usePlayerShortcuts,
                          useAppCommands (command id → handler), useDismiss, useScreenshot,
                          useSubtitles, useEffectSettings, useEffectChain, ...
  utils/                  queue (reducer), effectSettings (reducer), effectStorage, cueText, step
  shader/gl/              context, program, shaderError, target, quad, includes, commonChunks,
                          passTypes, passPlan (pure), passGraph, videoSource, renderPolicy (pure),
                          effectRenderer
  shader/glsl/common/     color, yiq, noise, gaussian, sampling, blur, resample, subcarrier,
                          composite-encode, composite-decode  (#include "name"; pure, no p_/d_ names)
  shader/effects/         types.ts, params.ts (generic helpers), registry.ts
  shader/effects/shared/  signal.ts (NTSC timing: subcarrier and cutoff cycles per sample),
                          chunks.ts (glob -> chunk map), tube/ (the CRT tube as a reusable display stage:
                          params, derive, pipeline (tubePasses), chunks, glsl/{beam,geometry,mask,post,display},
                          passes/{linearize,glow-h,glow-v,diffuse-down,diffuse-up}.frag)
  shader/effects/crt/     params, presets, derive, pipeline, index, passes/{raster,signal-encode,signal-decode,main}.frag
  shader/effects/vhs/     params, presets, derive, pipeline, index, passes/{frame,tape-h,tape-v,signal-encode,signal-decode,main}.frag,
                          glsl/{timebase,tape-noise,dropout,osd,osd-font}.glsl
tests/                    vitest; tests/shaders/compile-entry.ts is the check:shaders entry
scripts/                  dev.mjs, build-electron.mjs, check-shaders.mjs (+ -main.cjs)
```

## How it fits together

- **Playback:** ffprobe every file. Native when Chromium can decode it; otherwise ffmpeg remuxes or transcodes live into a growing fragmented MP4 served at `svp-media://stream/<id>`. Seeking or switching audio in that mode restarts ffmpeg (`restartStream`).
- **Effect on:** the `<video>` stays in the DOM but hidden (`.video-hidden`, never `display:none`), `VideoSource` uploads frames on `requestVideoFrameCallback`, `PassGraph` runs the effect's passes, the last pass draws to the canvas. `EffectRenderer` renders only when a frame, parameter or size changed, or while an `animated` parameter is non-zero during playback.
- **Effect off:** the plain `<video>` is shown, the canvas is unmounted and its WebGL context released.
- **CRT pipeline:** `raster → signalEncode → signalDecode → linearize (feedback) → glowH → glowV → diffuseDown → diffuseUp → main` (`linearize…diffuseUp` come from `tubePasses` in `shared/tube/pipeline.ts`; `main.frag` just calls `tubeDisplay` from `shared/tube/glsl/display.glsl`). Everything before `main` is in tube space at raster resolution.
- **VHS pipeline:** `frame → tapeH → tapeV → signalEncode → signalDecode → linearize → glowH → glowV → diffuseDown → diffuseUp → main`. The signal pair runs only when `connection` is Composite; the tube passes only when `tv` is on (glow needs `glow > 0`, diffusion needs `halation` or `diffusion > 0`). A disabled pass forwards its first input. `main.frag` draws flat with the TV off and calls the tube display with it on. The tape passes run on the tape raster (`d_tapeWidth` × `d_tapeLines`).
- **Settings:** `localStorage` keys `svp.effect.active` and `svp.effect.<id>`; loaded through `resolveValues`, so stale or out-of-range values heal. First run: the first registered effect (CRT, the fallback in `effectSettings.ts`) with its first preset selected, but the effect is off.
- **Subtitles** are always drawn by `SubtitleOverlay` (track kept in `hidden` mode) so they look the same with the effect on or off.

## Rules

- **One source of truth per parameter.** An effect parameter is declared once in `effects/<effect>/params.ts` as a `ParamSpec` (the tube's parameters in `effects/shared/tube/params.ts`, spread into each effect that has a tube). Uniforms (`p_<id>`), the settings panel, presets, persistence and reset are all generated from that table. Never hand-write a slider or a uniform upload for a parameter. Select option order is part of the shader contract (see the index constants in `crt/params.ts` and `shared/tube/params.ts`).
- **Derived values live in `derive.ts`** (pure, unit-tested) and reach shaders as `d_<name>`; the engine adds the `p_`/`d_` prefixes. Where a shader and `derive.ts` share an assumption, keep them in step and say so in a comment. Current pairs: mask transmittance (`shared/tube/glsl/mask.glsl` ↔ `maskTransmittance` in `shared/tube/derive.ts`), peak-1 beams with duty σ√(2π) (`shared/tube/glsl/beam.glsl` ↔ `exposureGain` in `shared/tube/derive.ts`), and `BEAM_SIGMA_MAX = 0.55` in `shared/tube/params.ts` (the three-line beam sum is only accurate up to that width).
- **Shader contract:** GLSL ES 3.00, `vUv` origin top-left, `out vec4 fragColor`, `#include "name"` for shared chunks, every uniform a float except samplers, `uFrame` (per render: noise seeds) and `uVideoFrame` (per presented video frame: dot crawl, bob). `uTime` is the media position in seconds in both playback modes (the stream start offset is added in `renderPolicy.mediaPosition`), so it can be large: wrap it before using it as a phase. A uniform used by several chunks is declared once. `gl_FragCoord` is bottom-left origin in every pass; only use it where origin does not matter (mask, noise, dither). Use `textureLod` wherever derivatives are undefined (after an early return, inside loops with `break`).
- **Integer maths:** a pass that uses integer division or `%` (the OSD chunks do) declares `precision highp int;`. `mediump` int division crashed Mesa's AMD shader compiler and killed the GPU process.
- **Float targets:** an effect that stores signed or >1 values sets `requiresFloat`; it then refuses to start on a GPU without float render targets instead of rendering garbage.
- **Shader licensing:** this repo is MIT. Do not paste code from GPL/LGPL shaders (CRT-Royale, CRT-Guest-Advanced, CRT-Geom, Easymode, zfast, Themaister/NTSC-Adaptive, blargg, Patchy NTSC). Permissive sources may be adapted with a credit in the file and in `THIRD_PARTY_NOTICES.md`.
- **Commands are declared once** in `shared/commands.ts` (id, label, group, keys, accelerator). Keyboard shortcuts, the native menu, tooltips (`hint()`) and the `?` overlay are generated from it; add a handler in `renderer/hooks/useAppCommands.ts`. Never hard-code a shortcut hint.
- **Styling uses tokens** from `renderer/styles/tokens.css` (colour, type scale, spacing, radii, layers); no raw hex/rgba outside it. Shared UI primitives live in `renderer/components/common/` (Button, Panel/PanelHeader, Kbd, Segmented, Switch, Slider, Dropdown, IconButton, Toast), and `useDismiss` handles Escape and outside-click for every overlay.
- **Fonts:** Archivo is bundled via `@fontsource-variable/archivo` (imported in `renderer/main.tsx`), so the UI works offline. Don't load fonts from a CDN.
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
3. Add tests for `derive.ts`. `tests/effects/definitions.test.ts` runs the generic checks for every effect in `EFFECTS` (unique ids, declared groups, defaults in range, preset validity, `p_`/`d_` names, samplers). `pnpm check:shaders` covers compilation.

A new effect can reuse `glsl/common/` (subcarrier, composite encode/decode, blur, resample), `effects/shared/signal.ts` (NTSC timing) and `effects/shared/tube/` (tube params, derive, passes, display). An effect chunk with the same name as a common or tube chunk silently shadows it (`tests/effects/chunks.test.ts` guards this).

## Known gaps

- CRT preset values were tuned against synthetic test patterns only; they need a pass against real footage.
- VHS presets were tuned on a handful of clips; they need a pass against more real footage.
- VHS: not checked by a person: how wobble and tracking-band roll look in motion, and slider dragging.
- VHS models NTSC only (no PAL/SECAM) and the picture only; audio is not degraded.
- VHS dropouts are seeded per render, so a replayed frame does not get the same dropouts.
- VHS with the TV stage off still renders at display rate while the hidden tube "Static noise" parameter is non-zero (it is `animated`).
- Not yet exercised interactively: slider dragging, drag-and-drop, file dialogs, fullscreen, context-loss recovery, the installed `.deb`.
- Not measured: 4K frame time, whether hardware video decode engages (`chrome://gpu`).
- The horizontal filter in `beam.glsl` does not widen when the raster is minified (windows narrower than the raster width may alias).
- Phosphor persistence treats a re-render of the same paused frame as a new frame.
- No HDR, no image-based subtitles (PGS/VobSub), ASS styling is dropped on conversion.

## Commits

Small, descriptive checkpoints: imperative subject line, body listing what changed and why. One workstream per commit, and each commit should pass the gates on its own.
