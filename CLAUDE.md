# Shader Video Player

Desktop video player (Electron) that draws the video through multi-pass WebGL2 shader effects. Two effects: CRT television (`crt/`, first in the registry) and VHS tape (`vhs/`), both built on `effects/shared/`. With no file open, the home screen (video library, TV preset picker, latest updates) is painted on a 2D canvas and drawn through the same effects. Personal daily-use player, Linux/Wayland first. The repo also holds `website/`, a separate Astro product site (see [Website](#website)).

Design specs in `docs/superpowers/specs/`: `2026-11-15-shader-video-player-design.md` (read before changing the shader layer), `2026-11-15-vhs-effect-design.md`, `2026-11-16-home-screen-design.md`, `2026-11-18-vcr-osd-ui-design.md` (player chrome and OSD), `2026-11-18-extra-features-design.md` (download, convert, export, update). Plan for drawing the player UI through the shader: `docs/2026-11-18-osd-through-shader-plan.md`.

## Commands

```bash
pnpm dev            # vite + esbuild watch + Electron
pnpm typecheck      # renderer/tests and electron tsconfigs
pnpm test           # vitest (pure logic only, no GL)
pnpm check:shaders  # compiles every effect pass on the real GPU in a hidden Electron window
pnpm build          # typecheck + renderer bundle + main bundle
pnpm dist           # .deb in release/ (launcher icons: build/icons/<N>x<N>.png, hicolor sizes up to 512)
```

Run `pnpm typecheck && pnpm test && pnpm check:shaders` before every commit, and check the exit status itself: piping a gate through `tail`/`grep` hides a failure. CI (`.github/workflows/ci.yml`) runs only `typecheck` and `test` (no GPU), so `check:shaders` is the local gate's job.

Website (its own checks; the root gates never see it: root `tsconfig.json` includes only `renderer`/`shared`/`tests`, vitest only `tests/**/*.test.ts`):

```bash
pnpm --dir website dev --background   # http://localhost:4321/shader-video-player/; dev status|logs|stop
pnpm --dir website check              # astro check
pnpm --dir website build              # website/dist
pnpm --dir website test:browser       # Playwright, two builds (mocked key, no key), own preview on :4321
```

Stack: Electron 45, React 19, TypeScript 7 (strict), Vite 8, esbuild for the main process, vitest, pnpm 11. Build-script approval for dependencies lives in `pnpm-workspace.yaml` (`allowBuilds`).

## Command line

Subcommands are dispatched in `main.ts` before the single-instance lock (`cli/args.ts` is the pure parser). Only an exact first word dispatches, so `./update` or an absolute path still opens a file called "update".

```bash
shader-video-player download <url> [--no-play]
shader-video-player convert <file> [-o <out>] [--force]
shader-video-player export <file> [--effect <id>] [--preset <name>] [--settings <json>] [--size WxH] [-o <out>]
shader-video-player update [--check]
shader-video-player help [command]     # also --help, --version
```

- Exit codes: 0 ok, 1 failure, 2 usage, 130 cancelled (SIGINT). SIGTERM cancels all jobs and exits 143.
- Stdout is for results; progress (bar and time left) goes to stderr (`cli/progressBar.ts`).
- Headless commands (`convert`, `update`, `download --no-play`) disable hardware acceleration and the GPU shader disk cache. `export` needs a GPU and a display session (it renders in a hidden window).
- `download` without `--no-play` hands the file to a running instance through `requestSingleInstanceLock` `additionalData` (the GUI opens it and registers the downloads folder), or becomes the GUI itself.

## Layout

```
electron/                 main process
  main.ts window.ts menu.ts links.ts gpuFlags.ts powerSave.ts   links.ts: fixed Help menu URLs + About panel
  recents.ts recentsShape.ts jsonStore.ts  recents and the validated userData JSON store (readJson/writeJson)
  ipc.ts subtitleIpc.ts preload.ts     IPC surface
  protocol.ts allowlist.ts             svp-media:// (file + stream), the one servable file
  playback.ts selection.ts queue.ts    open/restart with a generation counter; queue allow-set;
                                       selection.ts: openSelection, openSelectionAt (library opens)
  library/                             home screen library: service (folders, index, scans), walker
                                       (caps, symlink rules), shape (heals library.json and the metadata cache),
                                       folders (nesting rules), ids, metaParse, metaQueue (light ffprobe),
                                       watcher (fs.watch + debounce), state, libraryIpc, queueWindow
  devCapture.ts                        screenshot harness (dev only)
  screenshot.ts pngName.ts             save-PNG dialog and IPC; validates the PNG and file name
  media/                               probe, formats, ffmpegArgs, session (transcode),
                                       subtitles, externalSubtitles, processes, binaries,
                                       outputDir (Videos folder, writable fallback), outputName, audioOrdinal
  gui.ts                               GUI start, cliFiles, shutdown (main.ts only dispatches)
  jobs/                                job (state, cancel hook), registry, eta, ffmpegProgress,
                                       runFfmpeg (child + -progress), jobsIpc
  cli/                                 args (pure), progressBar (pure), router (exit codes),
                                       watchJob (the one job→reporter subscription), commands/{download,convert,export,update}
  download/                            url (SSRF guard), ytdlpArgs, ytdlpProgress, download, downloadIpc
  convert/                             convertArgs, convert, convertIpc
  export/                              exportArgs, exportRequest (pure validator + sizing), frameChunker,
                                       exportWindow (hidden window), exportJob, exportIpc
  exportPreload.ts                     preload for the hidden export page only
  update/                              semver, releases, check, install (verified .deb), run, menuCheck
shared/                   types.ts (PlayerBridge IPC contract, library types), subtitleFiles.ts, superseded.ts
  commands.ts             every command: id, label, group, keys, accelerator (single source)
  jobs.ts                 job states and the job:changed push shape; exportPage.ts: the export page's contract
renderer/
  App.tsx                 thin composition; keep it that way
  export.html export/main.ts   hidden export page (second Vite entry): offline render, frame pipeline
  components/             Controls, VideoView, ShaderCanvas, SubtitleOverlay, QueuePanel, VcrOsd (transient OSD),
                          JobHost (job panel), OpenUrlDialog, ExportDialog, ...
  components/common/      Button, Panel (+PanelHeader), Kbd, Segmented, Switch, Slider, Dropdown,
                          IconButton, Icon, Toast, iconGlyphs (12x12 pixel glyphs behind Icon),
                          Dialog (shell for every modal), ProgressBar
  components/effects/     EffectsPanel, PresetPicker, ParamGroup, ParamControl
  components/home/        HomeScreen (2D canvas + pointer), HomeMirror (visually hidden text for
                          assistive tech and tests), painter.ts (draws a home frame on the canvas)
  styles/tokens.css       colour (incl. the --tv-* home palette and derived --osd-*), type, spacing, radius, layer and focus tokens
  styles/home.css         home screen canvas and its source placement
  styles/vcr.css          shared VCR pieces: .vcr-text, .vcr-text-md, .vcr-box, .vcr-panel, .vcr-inverted, .vcr-rule
  styles/osd.css          the transient OSD (status and level slots)
  styles/dialog.css, styles/jobs.css   the shared dialog shell; job panel and progress bars
  hooks/                  usePlaybackSource, usePlayQueue, usePlayerState, usePlayerShortcuts,
                          useAppCommands (command id → handler), useOsd (+ useOsdControls), useDismiss, useScreenshot,
                          useSubtitles, useEffectSettings, useEffectChain, useHomeMenu (rows,
                          cursor, actions), useHomePaint (layout → canvas), useLibrary, useJobs,
                          useFeatureCommands, useOpenUrl, useConvert, useExport (+ featureTypes.ts: FeatureDeps), ...
  utils/                  queue (reducer), osd (OSD reducer and text formatting), effectSettings (reducer), effectStorage, cueText, step,
                          changelog, credits (bundled CHANGELOG.md and THIRD_PARTY_NOTICES.md headings), dropItems,
                          jobs, urlInput, exportRequest, exportSettings, pendingStart
  utils/home/             types (the 40x30-cell contract), model, libraryRows, layout, layoutRows,
                          state (reducer, keyToAction), hit, pointer, text, frame, effectValues (homeValues)
  shader/gl/              context, program, shaderError, target, quad, includes, commonChunks,
                          passTypes, passPlan (pure), passGraph, videoSource, renderPolicy (pure),
                          frameInput (the FrameInput contract), videoInput (<video>), canvasInput (2D canvas),
                          inputClock (pure), effectRenderer, effectUniforms and effectPipeline (setup shared by the
                          live and offline renderers), bufferInput, offlineRenderer (export frames)
  shader/glsl/common/     color, yiq, noise, gaussian, sampling, blur, resample, subcarrier,
                          composite-encode, composite-decode  (#include "name"; pure, no p_/d_ names)
  shader/effects/         types.ts, params.ts (generic helpers), registry.ts
  shader/effects/shared/  signal.ts (NTSC timing: subcarrier and cutoff cycles per sample),
                          chunks.ts (glob -> chunk map), tube/ (the CRT tube as a reusable display stage:
                          params, derive, pipeline (tubePasses), chunks, geometry.ts (pointer mapping through
                          the glass), glsl/{beam,geometry,mask,post,display},
                          passes/{linearize,glow-h,glow-v,diffuse-down,diffuse-up}.frag)
  shader/effects/crt/     params, presets, derive, pipeline, index, pointer, passes/{raster,signal-encode,signal-decode,main}.frag
  shader/effects/vhs/     params, presets, derive, pipeline, index, pointer, passes/{frame,tape-h,tape-v,signal-encode,signal-decode,main}.frag,
                          glsl/{timebase,tape-noise,dropout,osd,osd-font}.glsl
tests/                    vitest; tests/shaders/compile-entry.ts is the check:shaders entry
scripts/                  dev.mjs, build-electron.mjs, check-shaders.mjs (+ -main.cjs)
CHANGELOG.md              release notes, bundled into the home screen (`?raw`, parsed by utils/changelog.ts)
AGENTS.md                 short contributor guide; TODO.md: publishing tasks and wish list
.github/workflows/        ci.yml (typecheck + test), website-pages.yml (manual Pages deploy)
website/                  Astro 7 static site (CRT-TV), own package.json, pnpm-workspace.yaml, lockfile
  src/pages/              index, download, docs, contact, 404
  src/components/         Header, Footer, TvFrame, SectionHeading, CommandBlock, SignupSection, ContactForm
  src/layouts/            SiteLayout (head, canonical/social meta)
  src/lib/                site.ts (name, repo/releases/issues, author, install command, url(), absoluteUrl(), navigation), features.ts
  public/install.sh       curl | bash installer: newest release .deb, SHA256SUMS check, apt install
  src/scripts/forms.ts    Web3Forms submit and status states (the consent checkbox is in ContactForm)
  src/styles/             global.css (tokens, type, spacing, @fontsource imports), home.css
  src/content/guide.md    starter manual rendered on /docs
  public/images/          app screenshots (webp) + README.md (provenance)
  tests/site.spec.ts      Playwright; scripts/test-browser.mjs drives the two-build run
```

## How it fits together

- **Playback:** ffprobe every file. Native when Chromium can decode it (including `.mkv` with only WebM codecs, offered as `video/webm`: `isWebmCompatibleMkv`); otherwise ffmpeg remuxes or transcodes live into a growing fragmented MP4 served at `svp-media://stream/<id>` (2 s keyframes on transcodes, fragments of at most 1 s). Seeking or switching audio in that mode restarts ffmpeg (`restartStream`). Chromium reports a growing stream as unseekable, so `seek()` checks `video.seekable`, not `buffered`. A stream never starts in the last 3 s (`streamStartSec`): ffmpeg would write no complete fragment and Chromium fails to open it. Session and subtitle temp files live in `<tmp>/svp-media-cache/<pid>/`, so one instance's startup cleanup never deletes another's.
- **Stream ranges:** Chromium re-requests the stream mid-playback with `Range: bytes=N-`; the answer must start at N (`streamHead` in `electron/media/streamRange.ts`): an open-ended 206 (`bytes N-<far>/*`) whose body stays open until ffmpeg is done, because Chromium takes the end of any body of unknown length as the end of the file. Ignoring the Range was the "may be corrupt" bug. `SVP_DEBUG_MEDIA=1` logs requests, Range headers and ffmpeg.
- **Effect on:** the `<video>` stays in the DOM but hidden (`.video-hidden`, never `display:none`). `videoInput` wraps it as a `FrameInput`; `VideoSource` uploads frames from that input (on `requestVideoFrameCallback` for a video), `PassGraph` runs the effect's passes, the last pass draws to the canvas. `EffectRenderer` renders only when a frame, parameter or size changed, or while an `animated` parameter is non-zero during playback.
- **Effect off:** the plain `<video>` is shown, the canvas is unmounted and its WebGL context released.
- **Home screen:** shown whenever no plan is open (`App.tsx`). `useHomeMenu` holds the model (rows from `utils/home/model.ts`, library rows from `libraryRows.ts`) and the cursor; `layout()` is pure and turns state into a draw list in logical units (320×240, 40×30 cells of 8 px, 2-cell inset). `useHomePaint` paints it with `painter.ts` onto the 640×480 2D canvas, which is the effect's input through `canvasInput` (`FrameInput`). The effect draws it; the 2D canvas itself is kept 1 px and invisible as the source.
- **Home, effect off:** the 2D canvas is shown directly, pixelated, with no GL context. Paints still run: a minute timer for the clock, and one timeout set for the next marquee step or updates page turn (`layout()` reports it as `nextChange`), only while the window is visible and focused (`useHomePaint`, `utils/windowActivity.ts`).
- **Home framing:** `homeValues()` (`utils/home/effectValues.ts`) overrides overscan to 0 and the fit to letterbox for the menu only. Everything else is `fx.values` verbatim, OSD presets included.
- **Home TV preset:** the TV rows are the effects panel's setting. Picking one is `setEffect` + `applyPreset`; presets apply on Enter or click, never on focus (`choosePreset` would wipe custom edits). The Off row and an "EDITED" row exist. With the effect off, the preset that comes back is marked standby.
- **Home pointer:** a point on the output goes back through the glass with the effect's `pointerToSource` (`viewUv → source uv`, then `uvToLogical` in `utils/home/pointer.ts`), and `hitTest` finds the row. With the effect off the flat canvas is mapped with `containUv`. Only a real pointer move moves the cursor (Chromium also sends moves when the content under a still pointer changes).
- **Home keys:** widget keys on the focused home root (`keyToAction` in `utils/home/state.ts`): arrows, Tab, Page/Home/End, Enter/Space, Delete on a folder. They are not `COMMANDS`. `e` and `f` still work there. `l` and `?` are reserved.
- **Library:** registered folders live in `userData/library.json` (`{version, folders: [{id, path}]}`, healed by `shape.ts`). The walker is async and generation-checked after each await: depth 8, 5000 items per folder, 32 folders, dot entries skipped, symlinked directories never followed, a symlinked file kept only if it resolves inside the root. Nested or duplicate folders are refused (`folderConflict`).
- **Library metadata:** a light ffprobe (duration, size) per file, cached in `library-meta.json` and checked against size and mtime. Concurrency 2, 15 s timeout. Probing pauses while a video is open and is killed on quit; the cache is saved when the queue drains (at most every 30 s while it runs).
- **Library freshness:** a recursive `fs.watch` per folder, debounced 1.5 s. On a watcher error (or no watcher) the folder is rescanned on window focus and on `library:get`, at most every 5 s.
- **Library open:** `library:open(itemId)` queues the item's directory siblings (same subfolder, name order, windowed to `MAX_QUEUE` around the item) through `openSelectionAt`, so generation, allow-set and serving rules apply.
- **CRT pipeline:** `raster → signalEncode → signalDecode → linearize (feedback) → glowH → glowV → diffuseDown → diffuseUp → main` (`linearize…diffuseUp` come from `tubePasses` in `shared/tube/pipeline.ts`; `main.frag` just calls `tubeDisplay` from `shared/tube/glsl/display.glsl`). Everything before `main` is in tube space at raster resolution.
- **VHS pipeline:** `frame → tapeH → tapeV → signalEncode → signalDecode → linearize → glowH → glowV → diffuseDown → diffuseUp → main`. The signal pair runs only when `connection` is Composite; the tube passes only when `tv` is on (glow needs `glow > 0`, diffusion needs `halation` or `diffusion > 0`). A disabled pass forwards its first input. `main.frag` draws flat with the TV off and calls the tube display with it on. The tape passes run on the tape raster (`d_tapeWidth` × `d_tapeLines`).
- **Settings:** `localStorage` keys `svp.effect.active` and `svp.effect.<id>`; loaded through `resolveValues`, so stale or out-of-range values heal. First run (nothing stored): the first registered effect (CRT, the fallback in `effectSettings.ts`) with its first preset selected, and the effect is on. An existing saved state is kept; a stored `active: null` stays off.
- **Subtitles** are always drawn by `SubtitleOverlay` (track kept in `hidden` mode) so they look the same with the effect on or off.
- **Player OSD:** `VcrOsd` (DOM, over the picture, `aria-hidden`, same with the effect on or off) shows two independent slots: status (play/pause, seek, speed, repeat, subtitle delay) and level (volume). `utils/osd.ts` is the pure reducer; `useOsd` arms one timeout for the earliest expiry. Keyboard shortcuts show it from `useAppCommands`; clicks on the bar go through `useOsdControls`. The back/forward buttons call the `seekBack`/`seekForward` commands, not a separate path.
- **Jobs:** main owns every background job (download, convert, export) in `jobs/registry.ts`; the renderer holds only job ids and gets `job:changed` pushes (`shared/jobs.ts`). ffmpeg jobs run through `runFfmpeg`, which parses `-progress` output (`ffmpegProgress`, `eta`). stderr is always drained so a full pipe cannot stall ffmpeg. A job's cancel hook kills its child and deletes its `.part` file; success and failure do not run it. A `.part` file is renamed to its final name only on success.
- **Download:** system `yt-dlp` with `--ignore-config`, so a user's yt-dlp.conf cannot change output or run exec hooks; `--` before the URL; no `INPUT_PROTOCOLS` (yt-dlp fetches by design). Output goes to `<Videos>/Shader Video Player`, which the GUI registers as a library folder (`ensureLibraryFolder`). The CLI must never call `addFolders`. The file plays when done unless `--no-play`.
- **Convert:** offered only for transcode plans. One audio track (native playback needs at most one; `audioOrdinal`). Output is `<name>.svp.mp4` beside the source, or in the Videos folder when that is read-only. Playback reopens at the playhead through `pendingStart`.
- **Export:** ffmpeg decodes the source to raw RGBA. The hidden export window (`export.html`, `exportPreload.ts`) renders each frame with `OfflineRenderer` at a fixed time step of 1/fps, frame number `n` giving the time, so output does not depend on wall-clock speed. `readPixels` returns rows bottom-up, and the encoder runs `-vf vflip`. At most 2 frames are in flight. Default size is the source scaled up to at least 1080 tall. About 11 fps at 1080p with CRT, bound by IPC.
- **Update:** `update/` checks the newest GitHub release (pre-releases included) with a semver compare. Asset URLs are pinned to this repo's `releases/download` path. `SHA256SUMS` is verified in Node, then `sudo apt-get install -y` runs in the terminal (sudo may prompt). Help → Check for updates only points at the CLI and the releases page (`menuCheck`).

## Rules

- **One source of truth per parameter.** An effect parameter is declared once in `effects/<effect>/params.ts` as a `ParamSpec` (the tube's parameters in `effects/shared/tube/params.ts`, spread into each effect that has a tube). Uniforms (`p_<id>`), the settings panel, presets, persistence and reset are all generated from that table. Never hand-write a slider or a uniform upload for a parameter. Select option order is part of the shader contract (see the index constants in `crt/params.ts` and `shared/tube/params.ts`).
- **Derived values live in `derive.ts`** (pure, unit-tested) and reach shaders as `d_<name>`; the engine adds the `p_`/`d_` prefixes. Where a shader and `derive.ts` share an assumption, keep them in step and say so in a comment. Current pairs: mask transmittance (`shared/tube/glsl/mask.glsl` ↔ `maskTransmittance` in `shared/tube/derive.ts`), peak-1 beams with duty σ√(2π) (`shared/tube/glsl/beam.glsl` ↔ `exposureGain` in `shared/tube/derive.ts`), and `BEAM_SIGMA_MAX = 0.55` in `shared/tube/params.ts` (the three-line beam sum is only accurate up to that width).
- **Pointer through the glass:** every effect implements `pointerToSource` (`EffectDefinition` in `effects/types.ts`; generic check in `tests/effects/definitions.test.ts`). The tube part is `shared/tube/glsl/geometry.glsl` ↔ `shared/tube/geometry.ts` (CURVE_BULGE, curveFactorMinusOne, tube placement; comments on both sides). Each effect's `pointer.ts` mirrors its own passes: `crt/pointer.ts` ↔ `raster.frag` (and `main.frag`), `vhs/pointer.ts` ↔ `frame.frag` (and `main.frag`, tv on or off). The shaders carry no back-reference, so change the pointer file with them. Time-varying displacement (VHS wobble, tracking, head switch) is not mapped.
- **Engine input:** the engine draws from a `FrameInput` (`shader/gl/frameInput.ts`), never from a `<video>` directly: `videoInput` for the player, `canvasInput` for the home screen.
- **Home colours:** the home screen's colours are the `--tv-*` tokens in `tokens.css`. `painter.ts` reads them with `getComputedStyle`; no hex anywhere else.
- **Shader contract:** GLSL ES 3.00, `vUv` origin top-left, `out vec4 fragColor`, `#include "name"` for shared chunks, every uniform a float except samplers, `uFrame` (per render: noise seeds) and `uVideoFrame` (per presented video frame: dot crawl, bob). `uTime` is the media position in seconds in both playback modes (the stream start offset is added in `renderPolicy.mediaPosition`), so it can be large: wrap it before using it as a phase. A uniform used by several chunks is declared once. `gl_FragCoord` is bottom-left origin in every pass; only use it where origin does not matter (mask, noise, dither). Use `textureLod` wherever derivatives are undefined (after an early return, inside loops with `break`).
- **Integer maths:** a pass that uses integer division or `%` (the OSD chunks do) declares `precision highp int;`. `mediump` int division crashed Mesa's AMD shader compiler and killed the GPU process.
- **Float targets:** an effect that stores signed or >1 values sets `requiresFloat`; it then refuses to start on a GPU without float render targets instead of rendering garbage.
- **Shader licensing:** this repo is MIT. Do not paste code from GPL/LGPL shaders (CRT-Royale, CRT-Guest-Advanced, CRT-Geom, Easymode, zfast, Themaister/NTSC-Adaptive, blargg, Patchy NTSC). Permissive sources may be adapted with a credit in the file and in `THIRD_PARTY_NOTICES.md`.
- **Commands are declared once** in `shared/commands.ts` (id, label, group, keys, accelerator). Keyboard shortcuts, the native menu, tooltips (`hint()`) and the `?` overlay are generated from it; add a handler in `renderer/hooks/useAppCommands.ts`. Never hard-code a shortcut hint.
- **Styling uses tokens** from `renderer/styles/tokens.css` (colour, type scale, spacing, radii, layers); no raw hex/rgba outside it. Player chrome uses `--font-pixel` at `--px-sm`/`--px-md` (8/16 px) only, and the `--osd-*` roles (derived from `--tv-*`); shared VCR pieces live in `styles/vcr.css`. Press Start 2P has no `×` or `➤`: use `X` or a CSS/pixel-glyph shape. Shared UI primitives live in `renderer/components/common/` (Button, Panel/PanelHeader, Kbd, Segmented, Switch, Slider, Dropdown, IconButton, Toast), and `useDismiss` handles Escape and outside-click for every overlay.
- **Fonts:** Archivo is bundled via `@fontsource-variable/archivo` and Press Start 2P (the home screen's pixel face and the player chrome's face) via `@fontsource/press-start-2p`, both imported in `renderer/main.tsx`, so the UI works offline. Don't load fonts from a CDN. Font files are never inlined as `data:` URIs: the CSP has no `font-src` (`img-src` alone allows `data:`), so `vite.config.ts` sets `build.assetsInlineLimit` to return false for `.woff2`, `.ttf` and `.otf`.
- **Home keys:** home screen keys are widget keys handled in `utils/home/state.ts` (`keyToAction`), not `COMMANDS`; the `?` and `l` keys stay reserved.
- **Effect off means off.** Don't add per-frame work to the bypass path.
- **DRY:** reuse `renderer/components/common/*` and existing hooks before writing new ones; extract a shared piece once something appears three times. Pure state logic goes in a reducer-style module under `utils/` with tests; hooks stay thin.
- **File size:** keep files under ~300 lines; split by responsibility when they grow.
- **Media:** system `ffmpeg`/`ffprobe` from `PATH` (override with `SVP_FFMPEG_PATH` / `SVP_FFPROBE_PATH`). Nothing is bundled. All ffmpeg/ffprobe inputs carry `INPUT_PROTOCOLS` (`-protocol_whitelist`) so a playlist-format file cannot make ffmpeg fetch URLs.
- **Modal dialogs** use `common/Dialog`. Toast kinds are `success|error|info`.
- **Feature hooks** take one `FeatureDeps` object (`renderer/hooks/featureTypes.ts`), so `App.tsx` stays thin.
- **CLI commands** report through `watchJob` only, never by subscribing to a job themselves.
- **ExportRequest** is validated in main (`validateExportRequest`). Effect healing happens in the export page, because main cannot import the effect registry.

## Security model

The renderer is sandboxed with context isolation and is treated as untrusted.

- **Drops:** the page passes `File` objects; the preload resolves them to paths (`webUtils.getPathForFile`). The page never supplies a path string for a drop.
- **What can be opened:** `probe.ts` rejects anything that is not real video (images, `*_pipe`, playlist/network formats, no video stream, zero duration).
- **What can be served:** `allowlist.ts` holds only the one native file on screen. Transcodes are served by session id and never allowlist a path. `serveFile` uses the realpath it checked.
- **Queue:** `openQueued` only accepts paths the main process handed out for the current user selection (`queue.ts`), committed after an item actually opens.
- **Subtitles:** the renderer holds opaque ids; the main process approves files (picked, dropped, or siblings of the open video), checks extension and size, and converts with a forced demuxer.
- **Library:** the renderer holds opaque ids only (item = 16 hex of sha1 of the realpath, folder = `f-` plus 8 hex). Folders are added only by the main-process folder dialog or by a real directory drop, and a dropped path is re-resolved and re-`stat`ed in main. `library:open` re-resolves the item's realpath, checks that it is inside a registered folder's realpath, is still a video and still has the same id. Queued siblings are realpaths.
- **New IPC** goes `shared/types.ts` → `preload.ts` → `ipc.ts` and validates every argument in the main process.
- **Download:** `download:start` takes the URL through `parseVideoUrl` (`download/url.ts`): http/https only, no credentials, local and private literal hosts refused.
- **Convert and export:** `convert:start` and `export:start` act on the main-side current path, never on a renderer-supplied path. `job:open` and `job:reveal` use output paths held in main.
- **Export page:** its channels are accepted only from the export window.

## Concurrency rules

These came out of code review of the queue and transcode paths.

- Opens and restarts are superseded, not queued: `playback.ts` bumps a generation counter and a stale request throws `supersededError()` (`shared/superseded.ts`). Callers must treat `isSuperseded(e)` as "ignore silently": no toast, no state change.
- After any `await` in the main process, re-check the generation before using module-level state.
- In the renderer only the latest request may set the plan or the loading flag (`usePlaybackSource`).
- Auto-advance happens only when no load is in flight and the playhead is really at the end (`reachedEnd`): disposing a transcode session also fires `ended` on the old element.
- Kill child processes you supersede (stream sessions, subtitle extraction).
- Library opens take a request counter (`openRequest` in `libraryIpc.ts`): the latest click wins, and an older open throws superseded after each await.
- Library scans have per-folder generations (`scanGen` in `service.ts`), and a stop bumps the epoch: a superseded or stopped scan never touches the index.

## Verifying rendering without a person

`electron/devCapture.ts` (disabled in packaged builds) screenshots the window and quits:

```bash
pnpm exec vite build && pnpm build:electron
SVP_CAPTURE=/tmp/out.png SVP_CAPTURE_SIZE=1920x1080 SVP_CAPTURE_DELAY=6000 \
SVP_CAPTURE_KEYS=shift+E SVP_CAPTURE_EVAL='document.querySelector("canvas")?.width' \
  pnpm exec electron --no-sandbox . "$PWD/fixtures/clip.mp4"
```

- Keep test windows out of the way: `SVP_WINDOW_BOUNDS=x,y,w,h` sets the window's bounds and `SVP_WINDOW_INACTIVE=1` shows it without focus (`devWindowPlacement` in `devCapture.ts`, dev only). GNOME on Wayland ignores client positioning, so add `--ozone-platform=x11`, and with it `--disable-gpu-compositing`: under XWayland the GPU process crashes (`exit_code=8704`) as soon as a video plays, and every video then fails with decode errors that are not the app's. Coordinates are the `xrandr --listmonitors` layout; the user's test monitor is DP-1 (a 640x400 window in its bottom-right corner).
- `SVP_CAPTURE_KEYS` presses keys one second after load (`e`, `n`, `shift+E`, `ArrowRight`, …); `SVP_CAPTURE_EVAL` logs the result of a page expression as `[eval] …`; renderer console output is echoed.
- Effect state persists between runs, so `e` toggles whatever the last run left. Set state explicitly with an `SVP_CAPTURE_EVAL` that writes or clears `localStorage` in a short first run.
- Scanlines fade out below 2.5 output pixels per line by design; capture at 1080p or larger to see them, and crop/zoom with ffmpeg to inspect the mask.
- Manual launches need `--no-sandbox` in dev because the npm-installed `chrome-sandbox` is not setuid; `pnpm dev` adds it automatically. The packaged `.deb` is meant to run sandboxed.
- Test clips live in `fixtures/` (gitignored). Regenerate with ffmpeg `lavfi` sources, e.g. `smptebars`, `testsrc`, `testsrc2`, `mandelbrot` (mid-tones), plus an HEVC+AC3 MKV to exercise the transcode path and a same-named `.srt` for subtitles.
- The home screen shows with no file argument. For a library capture use a throwaway profile: `--user-data-dir=<scratch>/ud`, with `<scratch>/ud/library.json` seeded in the shape `electron/library/shape.ts` reads: `{"version":1,"folders":[{"id":"f-1a2b3c4d","path":"/abs/path/to/fixtures"}]}` (the id must match `^f-[0-9a-f]{8}$`, the path must be absolute). Items come from the scan, and `library-meta.json` is the probe cache.
- `SVP_CAPTURE_KEYS` are passed to `sendInputEvent` as `keyCode` (`devCapture.ts`), and the Electron type asks for accelerator key codes. Use names like `Down`, `Tab`, `Return` and check the result: the DOM name `Enter` was not checked against Electron's list.
- `SVP_CAPTURE_SIZE` calls `setContentSize`, which the compositor may not honour; check the PNG's dimensions.
- The home screen's text is in the DOM: `HomeMirror` lists every row with id `home-<zone>-<rowId>`, the screen sets `aria-activedescendant` to the cursor row, so `SVP_CAPTURE_EVAL` can read the cursor. With the effect off there is exactly one `<canvas>`; with it on there are two (the 2D source and the shader canvas).

## Adding an effect

1. Create `renderer/shader/effects/<id>/` with `params.ts`, `presets.ts`, `derive.ts`, `pipeline.ts`, `passes/*.frag`, and an `index.ts` exporting an `EffectDefinition` (set `requiresFloat` if needed).
2. Add it to `effects/registry.ts`. The panel, persistence and shortcuts pick it up from there.
3. Add tests for `derive.ts`. `tests/effects/definitions.test.ts` runs the generic checks for every effect in `EFFECTS` (unique ids, declared groups, defaults in range, preset validity, `p_`/`d_` names, samplers). `pnpm check:shaders` covers compilation.

A new effect can reuse `glsl/common/` (subcarrier, composite encode/decode, blur, resample), `effects/shared/signal.ts` (NTSC timing) and `effects/shared/tube/` (tube params, derive, passes, display). An effect chunk with the same name as a common or tube chunk silently shadows it (`tests/effects/chunks.test.ts` guards this).

## Website

`website/` is the product site. `website/README.md` is its full guide (setup, Pages, Web3Forms); `website/AGENTS.md` is the Astro template's boilerplate.

- **Separate project.** Own pnpm workspace and lockfile: install with `pnpm --dir website …`, never add site dependencies to the root (or app dependencies to the site).
- **Branding:** CRT-TV is the site's name only. Don't rename the desktop app, its window, package or `.deb`.
- **Base path:** the site is served under `SITE_BASE` (default `/shader-video-player`). Every internal link and asset goes through `url()` in `src/lib/site.ts`; `SITE_URL` is the origin only. Values come from `website/.env` locally, or Actions variables in CI.
- **Forms:** Web3Forms with `PUBLIC_WEB3FORMS_ACCESS_KEY`, a public key by design that ends up in the HTML. Env only, never committed (`.env` is gitignored, `.env.example` is the template); never put a private secret there. No key means the forms render as unavailable, and that path is tested. Signup requires explicit consent; a contact inquiry never subscribes the sender.
- **Styling:** tokens in `src/styles/global.css`, shared pieces in `src/components/`; same DRY and ~300-line rules as the app. Fonts are the same bundled `@fontsource` packages, no CDN.
- **Screenshots** in `public/images/` come from the devCapture harness on generated fixtures and show the desktop app's own branding; note how each was made in `public/images/README.md`.
- **Deploy** happens only through the manual `workflow_dispatch` of `website-pages.yml`. `test:browser` needs port 4321 free (stop a dev server first), mocks every submission and leaves `dist` built without the dummy key.
- **Install:** `public/install.sh` is served at `<base>/install.sh`; the Download page's `curl … | bash` (`site.installCommand`, built from `SITE_URL` + `url()`) runs it. It reads the newest GitHub release (pre-releases included), so every release must attach `shader-video-player_<version>_amd64.deb` and a `SHA256SUMS` covering it. Keep the script's body inside `main`.
- **SEO:** canonical/OG meta and `<link rel="sitemap">` in `SiteLayout`, JSON-LD `SoftwareApplication` on the home page. No `robots.txt`: under a project base path crawlers would never read it.

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
- A `.mkv` with WebM codecs plays natively but is served as `application/octet-stream` (`mimeForPath`); Chromium sniffs it. Matroska with H.264/HEVC still goes through ffmpeg.
- No HDR, no image-based subtitles (PGS/VobSub), ASS styling is dropped on conversion.
- Home screen: thumbnails and a tape-shelf view are not built (`thumb` is reserved in the library item and always null). Search, per-folder sort options and an online update check are out of scope (per the spec).
- Home screen: directory drop and the Add folder dialog are not exercised interactively (`partitionDrop` is unit-tested only).
- Home screen: non-Latin file names draw in the browser's monospace fallback, squeezed into one cell per code point.
- Home screen: the VHS "Third-generation dub" label is cut to `THIRD-GENERATION` in the TV column unless the cursor is on it, when it scrolls.
- Website: real Web3Forms delivery is unverified (needs a live key and inbox).
- Home screen: context-loss recovery on the GL path is untested. The effect-off path still runs the paint timers (see How it fits together).
- Download: the SSRF guard checks literal hosts only; DNS rebinding and redirects are accepted. A real cancel of a download is untested.
- Export: uses the first frame's size, so rotated phone video is not handled. Export from the app is untested end-to-end through the native save dialog.
- Release assets (`.deb` and `SHA256SUMS`) are still made by hand.

## Commits

Small, descriptive checkpoints: imperative subject line, optionally prefixed with the area (`Home:`, `VHS:`, `Library:`, `Site:`, `Docs:`), body listing what changed and why. One workstream per commit, and each commit should pass the gates on its own.
