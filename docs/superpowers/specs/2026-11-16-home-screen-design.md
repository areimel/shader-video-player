# Home screen rebuild: the menu is the TV

## Context

The screen shown with no video open is a small `EmptyState` (CSS-only fake tube, five recents). It becomes a real home screen in a 90s video-store / VCR on-screen-display / TV Guide channel style with three zones: a **video library** fed by user-registered folders, a **TV preset** picker, and **latest updates** with a small **dev credits** block.

Decisions made with the user:

| Topic | Decision |
|---|---|
| Shader on the menu | The whole menu is painted on a 2D canvas and drawn through the real CRT/VHS pipeline. WebGL cannot read DOM, so this is the only way every heading and row gets scanlines, curvature and noise. |
| TV preset | Same setting as the player's effects panel (`fx`). Entries: Off, then every preset of every effect. Picking one is `setEffect` + `applyPreset`, and the menu restyles live because it is drawn with `fx`. |
| Library look | TV-guide text listing now (title, length, resolution, folder). Data model carries a reserved `thumb` field; no thumbnails built. |
| Opening a library item | Plays it with the rest of its folder queued (name order), positioned at the chosen file. |
| Updates | `CHANGELOG.md` bundled with Vite `?raw`. Credits from `package.json` and `THIRD_PARTY_NOTICES.md` headings. |
| First run | CRT "Consumer TV" **on** (was off). Existing installs keep their saved state. |

Naming: "menu" already means the native menu, `useMenuCommands` and `menu.css`, so the feature is called **home** (`components/home/`, `utils/home/`, `styles/home.css`).

## Visual design

**Subject:** a VCR's blue on-screen menu crossed with the scrolling guide channel, seen on a consumer tube. The one bold thing is that the screen *is* the TV; everything painted on it stays flat, blocky and quiet so the shader does the talking.

**Palette** (new plain-colour tokens in `renderer/styles/tokens.css`; the painter reads them with `getComputedStyle`, so no hex elsewhere):

| Token | Value | Role |
|---|---|---|
| `--tv-blue` | `#0b1cb0` | background, the VCR "blue screen" |
| `--tv-navy` | `#050a4a` | header band, zone title bars, guide grid rows |
| `--tv-white` | `#f2f2e8` | text |
| `--tv-yellow` | `#ffd200` | selection bar, headings (ink on it is navy) |
| `--tv-cyan` | `#3fe0e0` | secondary columns: lengths, resolution, dates |
| `--tv-red` | `#ff3b30` | alerts, missing folder, the channel dot |

Legibility comes from luma contrast (yellow/white on blue), because chroma detail smears below ~5 px on composite presets.

**Type:** one monospaced 8×8 pixel face, bundled through `@fontsource` (OFL). First choice **Press Start 2P** (native 8×8, exactly one grid cell); fallback **VT323** if it reads too "arcade" in the first screenshot. Headings are the same face at double size. Capitals throughout, as on a VCR display. Non-Latin file names fall back to a system font via `fillText`. The player UI keeps Archivo.

**Grid:** 640×480 canvas authored as 320×240 logical pixels at 2×, so 40×30 cells of 8×8. A 2-cell inset on every side (curvature, corners, VHS head-switch band) leaves 36×26.

```
  SHADER VIDEO                 CH 03 12:41AM
  ==========================================
  LIBRARY                       MOVIES (3/41)
  > ALIEN.MKV               1:56:40  1080P
    AKIRA.MP4               2:04:12   720P
    HEAT.MKV                2:50:03  1080P
    ... 10 rows, scrolls ...
    + ADD FOLDER      RESCAN      OPEN FILE
  ------------------------------------------
  TV PRESET          | LATEST UPDATES
    OFF              | V0.2.0  NOV 16
  > CONSUMER TV      | - LIBRARY FOLDERS
    TRINITRON        | - HOME SCREEN ON TV
    WORN RENTAL      | DEV CREDITS
    BAD TRACKING     | ALEC REIMEL  V0.2.0
```

Library groups: "Recently played" first, then one group per registered folder. A focused row with a long title scrolls it (motion answering the user's action). The updates zone pages every few seconds like a guide channel; with reduced motion it is static and paged by key. No other autonomous motion; the shader's own noise is the ambience.

**Checked against generic defaults:** blue/yellow, caps and the grid all come from the brief's sources, not from a template. No logo or mark imitates Blockbuster or TV Guide.

## Architecture

### 1. Engine accepts any frame source
- New `renderer/shader/gl/frameInput.ts`: `FrameInput { image, size(), ready(), subscribe(onFrame({image:boolean})), playing(), time(), listen({onJump,onResized,onPlayState}) }`.
- `videoInput(video)` holds today's `requestVideoFrameCallback` loop, the `readyState`/`videoWidth` guard, the video events and the `playing ? mediaTime : currentTime` rule (moved from `effectRenderer.ts:53-62,158-160,191` and `videoSource.ts:38-54,67`). Player behaviour must be identical.
- `canvasInput(canvas)` + pure `inputClock.ts`: frames when the menu repaints (`painted()`), a ~30 Hz tick that advances `uVideoFrame` without re-uploading, a wall clock, `playing()` true only while the window is visible and focused (so an idle unfocused window costs no GPU).
- `VideoSource` keeps the texture/mips/counter and takes a `FrameInput`; the `"video"` pass input name is unchanged. `useEffectChain` and `ShaderCanvas` take a `makeInput` factory instead of `videoRef`.

### 2. Home screen in three layers
- **Pure** `renderer/utils/home/`: `model.ts` (rows for TV entries incl. Off and "edited", recents, updates, credits), `libraryRows.ts`, `state.ts` (reducer, `keyToAction`, `activate`), `layout.ts` (state to a draw list of rects/text runs plus hit regions in logical units), `hit.ts`, `text.ts` (column fit, duration/resolution format), `effectValues.ts`.
- **Painter** `components/home/painter.ts`: draws a draw list on the 2D canvas (`alpha:false`, origin-clean).
- **Thin UI** `components/home/HomeScreen.tsx`, `HomeMirror.tsx` (visually hidden list with `aria-activedescendant` for screen readers and tests), `hooks/useHomeMenu.ts`, `hooks/useLibrary.ts`.
- Effect off: the 2D canvas is shown directly with pixelated scaling, no GL context, no timers ("effect off means off").
- Menu-only framing overrides in `homeValues()`: overscan 0 (exact 2:1 row mapping, the inset replaces it) and letterbox fit (Crop on a 16:9 tube would cut the top and bottom rows). Everything else is `fx.values` verbatim, including the VCR/camcorder OSD on those presets.
- Presets apply on Enter/click, never on focus (`choosePreset` replaces values, so hover-preview would wipe custom edits).
- Keys are widget keys on the focused home root (arrows, Tab, Enter, Home/End), not `COMMANDS` (ArrowUp/Down are volume there). `l` and `?` stay reserved. `toggleEffect` (`e`) and `fullscreen` (`f`) move out of the media-only block in `useAppCommands.ts` so they work here. `ShortcutHelp` gets a static "Home screen" section like its `MOUSE` list.
- Loading spinner, toasts, drop overlay and shortcut help remain DOM overlays. `.drag-region` is not rendered over the home screen (it would swallow pointer events).

### 3. Pointer through the glass
- Required `EffectDefinition.pointerToSource(viewUv, values, env)` per effect, built on a TS port of `tubeGeometry` in `effects/shared/tube/geometry.ts` (keep-in-step comment on both sides; new documented shader/derive pair).
- CRT: tube rect, curvature, then `(tubeUv-0.5)*(1-overscan)/content+0.5` (`raster.frag:41-47`). VHS: tube rect, curvature only when `tv` is on; the frame pass is identity for a 4:3 source. Time-varying tape displacement is ignored.

### 4. Library (main process)
`electron/library/`: `shape.ts`, `ids.ts`, `walker.ts`, `metaParse.ts` (pure, tested), `metaQueue.ts`, `watcher.ts`, `service.ts`, `libraryIpc.ts`; plus `electron/jsonStore.ts` (validated read, atomic write) with `recents.ts` moved onto it.
- Storage: `userData/library.json` (folders) and a metadata cache keyed by path+size+mtime.
- Walker: async, generation-checked after each await, skips dot entries, never descends symlinked dirs, a symlinked file must resolve inside the root, caps of depth 8 / 5000 items per folder / 32 folders.
- Metadata: light ffprobe (`-show_entries`, with `INPUT_PROTOCOLS`), concurrency 2, 15 s timeout, paused while a video is open, killed on quit (`spawnTracked` gains a stdout-pipe option).
- Freshness: recursive `fs.watch` debounced 1.5 s; on watcher error fall back to rescan on window focus and on `library:get`.
- Security: the renderer holds opaque ids only (item = 16 hex of sha1(realpath), folder = `f-`+8 hex). `library:open(itemId)` re-resolves the realpath, checks it is inside a registered root, then calls a new `openSelectionAt(paths, index)` in `electron/selection.ts` built on the existing `openMedia`/`commitQueue`, so generation, queue allow-set and allowlist rules hold. Folders are added by a main-process `openDirectory` dialog or by dropping a directory (resolved in preload, re-`stat`ed in main, confirmed with a toast).
- Bridge additions (`shared/types.ts` → `preload.ts` → `libraryIpc.ts`): `getLibrary`, `addLibraryFolder`, `addLibraryDropped`, `removeLibraryFolder`, `rescanLibrary`, `openLibraryItem`, `onLibrary`, `onLibraryMeta`. Every argument validated by regex/shape in main.
- New command `addFolder` (File group) in `shared/commands.ts`.

### 5. Changelog and credits
`CHANGELOG.md` at the repo root; `renderer/utils/changelog.ts` and `credits.ts` (pure, tested); version/author through Vite `define`.

### 6. Removed
`EmptyState.tsx`, `RecentFiles.tsx`, `Logo.tsx`, `HelpNote.tsx`, `styles/empty.css` (its global `kbd` rule moves to `widgets.css` first).

## Commits (each passes `pnpm typecheck && pnpm test && pnpm check:shaders`)

0. Design spec `docs/superpowers/specs/2026-11-16-home-screen-design.md` (this plan as the written design)
1. Contracts: `frameInput.ts` interface, library types, `utils/home/types.ts`
2. Engine: `FrameInput` refactor, player unchanged
3. Engine: canvas input and clock
4. Effects: `pointerToSource` and the tube geometry port
5. Main: validated JSON store, recents moved onto it, library pure core
6. Library service: probe queue, watcher, IPC, `openSelectionAt`
7. Changelog and credits
8. Home core (pure): model, reducer, layout, hit test
9. Home screen replaces the empty state (recents, TV preset, updates, credits), font and tokens
10. Home: library listing, add/remove/rescan, directory drop
11. First-run default: CRT Consumer TV on
12. Docs: CLAUDE.md, README, THIRD_PARTY_NOTICES (font)

## Agents (about 16, not 35: more would collide on files)

Work happens on a new branch `feat/home-screen` off the current one. Wave-1 builders each get an isolated worktree and a disjoint file set; I integrate in commit order and run the gates myself.

| Wave | Agent | Model | Work |
|---|---|---|---|
| 0 | me | – | Commits 0–1 (frozen interfaces) |
| 1 | Engine | Opus | Commits 2–3 |
| 1 | Pointer | Sonnet | Commit 4 |
| 1 | Library | Opus | Commits 5–6 (security and concurrency rules) |
| 1 | Changelog | Haiku | Commit 7 |
| 1 | Home core | Sonnet | Commit 8 |
| 1 | First-run | Haiku | Commit 11 (landed in order) |
| 1r | 3 reviewers | Sonnet | Independent review of engine, library, home core diffs |
| 2 | Home UI | Opus | Commit 9, then 10 |
| 2 | 2 capture checkers | Sonnet | Screenshots per preset, hit-test probes, legibility notes |
| 2r | 2 reviewers | Sonnet | UI diff; security review of the IPC surface |
| 3 | Docs | Haiku | Commit 12 |
| 3 | Simplifier | Sonnet | DRY and file-size pass (all files under ~300 lines) |

## Verification

- Gates on every commit, exit status checked directly.
- Unit tests added: `tests/gl/inputClock`, `tests/effects/pointer` (+ a generic case in `definitions`), `tests/library/{walker,ids,shape,metaParse}`, `tests/recentsShape`, `tests/changelog` (parses the real file), `tests/home/{state,layout,model,libraryRows,effectValues}`; `tests/effects/settings.test.ts:50` updated for the first-run change.
- Engine regression after commits 2–3: capture a fixture clip with the effect on before and after, compare PNGs.
- Home screen through the capture harness with a throwaway profile and a seeded `library.json` pointing at `fixtures/`:
  `SVP_CAPTURE=… SVP_CAPTURE_SIZE=1920x1080 pnpm exec electron --no-sandbox --user-data-dir=<scratch>/ud .`
  - one capture per preset (keys: arrows + Enter), checked for readable rows and nothing cut off
  - `SVP_CAPTURE_EVAL` reading `svp.effect.active` to confirm the pick persisted
  - a synthetic `pointermove` at the centre and near a corner, comparing the mirror's `aria-activedescendant` with the highlighted row
  - effect off: exactly one canvas, no GL
  - copy a clip into the seeded folder mid-run and confirm it appears
- Open the library item, confirm the queue holds its folder and next/previous work; confirm "Back to home" returns.

## Not in this session
Thumbnails / tape-shelf view, online update check, search, per-folder sort options.
