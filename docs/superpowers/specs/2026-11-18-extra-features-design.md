# Extra features: download, convert, export, update (design)

Date: 2026-11-18. Branch: `feat/extra-features`.

## Approaches considered

- **Export pipeline.**
  - **Picked:** ffmpeg decodes to raw RGBA, a hidden window renders the existing effect passes one frame at a time and reads the pixels back, and a second ffmpeg encodes them with the source audio. It plays every format the player already opens, the window never sees a file path, and every frame is rendered exactly once.
  - **Rejected:** WebCodecs decode and encode inside the window. It needs a demuxer library and fails on formats Chromium can't decode, which are exactly the files Convert exists for.
- **Build order.**
  - **Picked:** a shared foundation first (jobs, progress, CLI router), committed once, then four feature teams in parallel.
  - **Rejected:** all four teams at once. Each would build its own progress handling, which goes against DRY.
- **Update.**
  - **Picked:** a terminal command with a version check, a SHA-256 check and `sudo apt-get install`, plus a Help-menu check that points at it.
  - **Rejected:** in-app install via pkexec. It is out of scope per the home-screen spec.

## Context
TODO.md "Extra Features" lists four wishes for the daily-use player: (1) download a YouTube video and play it, (2) convert files that need live transcoding into native mp4 so seeking is smooth, (3) export a video with the shader effect baked in, plus a headless CLI with a progress bar and ETA, (4) a CLI `update` command.

Features 1–3 all need long-running jobs with progress, which the app has none of today: ffmpeg runs with `-loglevel error`, nothing pushes progress from main to the renderer, and toasts are fixed at 4 s. A shared foundation is therefore built first, then four feature teams run in parallel in git worktrees. Work happens on the existing branch `feat/extra-features`, with a PR at the end.

### Decisions (user)
- **Convert:** for smooth seeking. Offered when a file plays through transcode. Output goes next to the original, falling back to the downloads folder if that directory isn't writable.
- **Download:** system yt-dlp, shipped as deb **Recommends**. Files go to `~/Videos/Shader Video Player` (`app.getPath("videos")`), which is auto-registered as a library folder (skipped if an existing folder already covers it). The video then opens.
- **Export:** ffmpeg decodes to raw RGBA, a hidden window renders the existing passes one frame at a time and reads the pixels back, and ffmpeg encodes them with the source audio.
  - Default size is the source size, scaled up so it is at least 1080 px tall (even dimensions). `--size WxH` overrides it.
  - Uses the current effect settings in the app; `--effect`, `--preset` and `--settings f.json` on the CLI.
- **Update:** `shader-video-player update` checks the newest GitHub release (pre-releases included, same as install.sh) and says "up to date" if nothing is newer. Otherwise it downloads the deb, verifies SHA256SUMS in Node, and runs `sudo apt-get install -y` in the terminal.
  - `--check` only checks.
  - Help menu gets "Check for updates…" (a dialog that points at the CLI and the releases page).
- **Team split:** foundation first, then four teams in parallel, merged one at a time.

### Corrections from the design check (must follow)
- stderr is always piped by `spawnTracked`, so every long job must drain it or the child blocks. The foundation adds a `tailLines` ring buffer for this.
- The CLI must never call `addFolders`. With the library not started it would overwrite `library.json`. Registration happens in the GUI only, through `ensureLibraryFolder` together with the pure `folderCoverage` (`library/folders.ts`).
- CLI subcommands are dispatched before `app.requestSingleInstanceLock()` (`electron/main.ts:53`). A download hands its file to a running instance with `requestSingleInstanceLock({files:[path]})` and `additionalData` in `second-instance`.
- Native playback needs a single audio track (`nativeMime`), so convert maps exactly the current `audioOrdinal`.
- Make `videoArgs`/`audioArgs` reusable without exporting them as they are: `videoArgs(info, enc, profile: "live"|"file")` (file profile is `-preset medium -crf 20`, no zerolatency, no forced keyframes), and `audioArgs(info, ordinal, input = 0)`.
- `VideoSource.videoFrame` is already public; offline export ticks it once per pushed frame and must never call `uploadNow(true)`.
- The export page is a second Vite entry, `renderer/export.html` via `build.rolldownOptions.input`, not the check-shaders data-URL pattern, which can't ship in the .deb. Effect, preset and settings healing runs in the export page, because main can't import the registry.
- The Help menu is hard-coded in `menu.ts:59-66`. "Check for updates" is a main-side click there, not a `COMMANDS` entry.

## Foundation (F): committed before any team starts
**Media and jobs (main process)**
- `electron/media/processes.ts`: add a `stdin` option and `tailLines`.
- `electron/media/binaries.ts`: add `ytDlpPath()` (overridable with `SVP_YTDLP_PATH`).
- `electron/media/ffmpegArgs.ts`: the profile and input changes above, plus `PROGRESS_ARGS`.
- New: `electron/media/outputDir.ts` (`appVideosDir`, `writableDirOr`) and `outputName.ts` (pure: `uniqueName` → `x.svp.mp4`, `x.svp (2).mp4`; `partPath`).
- `shared/jobs.ts`: `JobKind`, `JobProgress {fraction, etaSec, label}`, `JobSnapshot`, `ExportRequest`, channel names.
- `electron/jobs/`:
  - `job.ts`, `registry.ts`: the renderer holds job ids only; cancel kills the children and deletes the `.part` file.
  - `ffmpegProgress.ts` (pure): parses `-progress pipe:1`.
  - `eta.ts` (pure): EWMA of the rate.
  - `runFfmpeg.ts`: shared by convert and export.
  - `jobsIpc.ts`: `job:changed` push, `job:cancel`, `job:open(id, startSec?)`, `job:reveal`.
- `electron/library/folders.ts` + `service.ts`: `folderCoverage` and `ensureLibraryFolder`.

**Wiring and stubs, so the teams don't conflict**
- `shared/types.ts` + `preload.ts`: declare and wire every bridge method now: `onJob`, `cancelJob`, `openJobResult`, `revealJobResult`, `downloadUrl`, `convertCurrent`, `exportCurrent`.
- `electron/ipc.ts`: register the jobs IPC and three stub feature modules: `electron/download/downloadIpc.ts`, `electron/convert/convertIpc.ts`, `electron/export/exportIpc.ts`.
- `shared/commands.ts`:
  - `openUrl`: "Open URL…", `CmdOrCtrl+U`
  - `convert`: "Convert for smooth playback"
  - `exportVideo`: "Export with effect…", `CmdOrCtrl+E`

  Check for key clashes with the existing `e`/`E` single keys.
- Renderer:
  - `components/common/ProgressBar.tsx`: reuses the `.slider-track` / `.slider-fill` styles; indeterminate when the fraction is null.
  - `hooks/useJobs.ts` + `utils/jobs.ts` (a reducer, tested).
  - `components/JobHost.tsx` + `styles/jobs.css`: reuses the toast classes.
  - Optional `action` on `ToastItem`.
  - `hooks/useFeatureCommands.ts` composing stub hooks `useOpenUrl`, `useConvert` and `useExport`, which are spread once into `useAppCommands.ts`.
  - `App.tsx` mounts `JobHost`.
- CLI:
  - `electron/cli/args.ts` (pure): skips Chromium switches; a subcommand matches only by exact name.
  - `progressBar.ts` (pure): redraws with `\r` on a TTY, otherwise prints a line every 5% or 10 s.
  - `router.ts`: `CliCommand {name, usage, summary, needsGpu?, run}`, `help`, exit codes 0/1/2/130, SIGINT cancels.
  - Stub commands in `commands/{download,convert,export,update}.ts`.
  - Commands that don't need a GPU call `disableHardwareAcceleration`; CLI runs add `--log-level=3`.
- `electron/main.ts`: CLI dispatch before the lock; GUI start moved into `startGui(files)`; `additionalData` handling; `cancelAll()` in `shutdown` before `killAll`.
- Tests: ffmpegProgress, eta, cli args, progressBar, outputName, folderCoverage, the jobs reducer, and ffmpegArgs (both profiles).

## Teams (after F; each team edits only its own files)
**T1 Download.** `electron/download/`:
- `url.ts`: http/https only, at most 2048 characters.
- `ytdlpArgs.ts`:
  - `--ignore-config --no-playlist --newline --print after_move:filepath` and a `SVPDL` progress template.
  - Format chain preferring VP9+Opus, then avc1+m4a, at most 1080p.
  - `-o "%(title).150B [%(id)s].%(ext)s"`, with `-- url` last.
  - Never `INPUT_PROTOCOLS`.
- `ytdlpProgress.ts`.
- `download.ts`: if yt-dlp is missing (ENOENT), show an install hint. The final path must be inside the output dir (`isInside`) with a supported extension.
- Fill in `downloadIpc.ts`: on success run `ensureLibraryFolder`, then auto-open if nothing is playing; otherwise offer an Open action.
- CLI `download <url> [--no-play]`: hands the file to the GUI.
- UI: `renderer/components/OpenUrlDialog.tsx` (Panel, PanelHeader, Button, useDismiss) and `useOpenUrl`.
- `electron-builder.yml`: `deb.recommends: [yt-dlp]`. Re-add the defaults, since setting it replaces them.

**T2 Convert.**
- `electron/convert/convertArgs.ts`: `-map 0:v:0`, `videoArgs("file")`, `audioArgs(ordinal)`, `-sn -dn -movflags +faststart`, written to `.part`.
- `convert.ts`: output next to the source via `uniqueName`, falling back to `appVideosDir()`; rename the `.part` when done.
- `convertIpc.ts`: the source is `currentVideoPath()`; validate the ordinal.
- CLI `convert <file> [-o out] [--force]`: refuses a file that already plays natively unless `--force`.
- `useConvert`: the command works only when `plan.mode === "transcode"`. A one-time hint toast per path offers it.
- `usePlaybackSource.ts`: a `startAt` option, so the converted file opens at the current position.

**T3 Export.**
- Engine, behaviour unchanged for live playback:
  - Split `effectRenderer.ts` into `shader/gl/effectUniforms.ts` (pure) and `effectPipeline.ts`.
  - New `bufferInput.ts`: a `FrameInput` over a reused `ImageData`.
  - New `offlineRenderer.ts`: fixed `delta = 1/fps`, `frame = n`, `resetFeedback` at the start, `readPixels`.
- Page: `renderer/export.html` + `renderer/export/main.ts`; `utils/exportSettings.ts` (pure `resolveExportSettings`).
- Main:
  - `electron/exportPreload.ts`: frames and pixels only, never paths.
  - `export/exportArgs.ts`:
    - decoder: `fps=` filter, rawvideo rgba
    - encoder: rawvideo in, source audio mapped as `1:a:N?`, `-vf vflip`, file profile, `-shortest`, faststart
    - `parseSize`, `defaultSize`
  - `frameChunker.ts` (pure).
  - `exportWindow.ts`: hidden window with `backgroundThrottling: false`; factor `hardenContents()` out of `window.ts` and use it here.
  - `exportJob.ts`: at most 2 frames in flight; respects `drain`.
  - Fill in `exportIpc.ts`: validate effect, values and size; save dialog.
- CLI `export <file> [--effect] [--preset] [--settings] [--size] [-o]` (`needsGpu`).
- UI: `ExportDialog.tsx` (Segmented sizes "Source ≥1080p", "1080p", "Window") and `useExport`.
- Build: `vite.config.ts` second input; `scripts/build-electron.mjs` adds the `exportPreload` entry.

**T4 Update.** `electron/update/`:
- `semver.ts`: a pre-release counts as lower than the release.
- `releases.ts`: `pickAssets` requires URLs under `github.com/areimel/shader-video-player/releases/download/`; `parseSums`.
- `check.ts`: fetch with a 10 s timeout.
- `install.ts`: mkdtemp, sha256 check, chmod 755/644, `sudo apt-get install -y` with stdio inherited, no sudo as root.
- CLI `update [--check]`.
- `menu.ts`: Help → "Check for updates…".
- `links.ts`: add `releases`.

**Docs (after the merges).**
- `CHANGELOG.md` Unreleased bullets.
- CLAUDE.md: layout, a CLI section, jobs rules, the new IPC in the security model, known gaps (export needs a GPU and a display session; IPC frame cost).
- `website/src/content/guide.md`: CLI section and the yt-dlp note.
- `TODO.md`: tick the items off.

## Verification
- Gates after every commit and every merge: `pnpm typecheck && pnpm test && pnpm check:shaders`, checking the exit status. `check:shaders` confirms the EffectRenderer split broke no passes.
- `pnpm exec vite build && pnpm build:electron`, then for each command:
  - `electron --no-sandbox . help` prints usage and exits 0.
  - `electron --no-sandbox . convert fixtures/<hevc>.mkv -o <scratch>/c.mp4`: the progress bar advances, and ffprobe shows h264 + aac with one audio track and faststart.
  - `electron --no-sandbox . export fixtures/clip.mp4 --preset <crt preset> -o <scratch>/e.mp4`: ffprobe shows the expected size (at least 1080 tall) and the frame count. Extract a frame and look at it for scanlines and the right way up.
  - `electron --no-sandbox . download <short public video URL> --no-play`: the file lands in the videos dir. Ask the user for a test URL.
  - `electron --no-sandbox . update --check` reports the newest release against 0.3.0. Don't run an actual install without the user's consent.
- In-app via devCapture (DP-1 bottom-right window, `--ozone-platform=x11 --disable-gpu-compositing`):
  - The convert hint appears on the HEVC fixture.
  - The JobHost card shows progress.
  - The Open URL dialog opens with `Ctrl+U`.
- Merge `.deb` packaging check: `pnpm dist` builds and `dpkg -I` shows `Recommends: yt-dlp`.
