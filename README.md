# Shader Video Player

A desktop video player that plays your files through real-time shader effects. The first effect is a physically inspired **CRT television**: scanline beams, phosphor masks, glow, tube curvature and analog composite/S-Video signal artefacts, with presets and a control for every parameter. A second effect, a **VHS tape**, models a home video deck: tape bandwidth, head-switching and tracking faults, dropouts and an optional TV stage.

Built on Electron, React and WebGL2. Linux (Wayland/X11) is the supported platform for now.

> Status: early development. Everything below works, but the presets were tuned on test patterns and a few clips and still need a pass against real footage. See [Known limitations](#known-limitations).

![CRT effect with the settings panel open](docs/images/crt-effect-panel.jpg)

<details><summary>Close-up of three presets (Trinitron, Arcade, PVM)</summary>

![Phosphor mask and scanline close-ups](docs/images/presets-closeup.jpg)

</details>

## Features

- Plays MP4, MKV, WebM, MOV, AVI and more. Formats Chromium cannot decode (HEVC, AC3/DTS audio, AVI…) are converted on the fly with ffmpeg.
- Open dialog, drag and drop, an Open Recent menu, resume position, playback speed, audio track selection, fullscreen, picture-in-picture, and a remaining-time toggle.
- Opens only real video files: images, playlists and network formats are refused.
- Play queue: open or drop several files (Ctrl+Shift+O, or Shift+drop, adds to the queue), next/previous, auto-advance, and loop off / all / one.
- Top bar with the file name and queue position. Ctrl+W or the top-bar back button returns to the home screen.
- End screen when the queue finishes: Replay, Play queue again, or Back to home.
- Home screen, drawn through the active effect: a TV-guide style video library (recently played, then your folders), a TV preset picker that is the same setting as the effects panel, and the latest updates.
- Video library: add folders you choose (Add library folder, or drop a folder on the home screen). Videos are listed with their length and resolution, and the folders are watched for changes.
- Screenshots (`S` or Ctrl+Shift+S) save the current frame, with the active effect applied, as a PNG.
- Subtitles: embedded tracks plus external `.srt`, `.vtt`, `.ass` files (a file named like the video is picked up automatically). Subtitles are drawn above the effect so they stay sharp, with a text size control and a timing delay.
- Shortcut overlay: press `?` for the full list of keys.
- Keyboard-accessible sliders, menus and panels; `Escape` closes whatever overlay is open.
- CRT effect with four presets: Consumer TV (composite), Trinitron (S-Video), Arcade monitor (RGB), Broadcast monitor (PVM), and a settings panel with a control for each of its ~50 parameters. Settings are remembered between runs.
- VHS tape effect with seven presets, three framing modes and a settings panel. Choose it from the effect dropdown in the effects panel. See [How the VHS effect works](#how-the-vhs-effect-works).
- Effects can be switched off instantly; with no effect active the video plays through the normal, low-power path.
- On first run the CRT effect is on with its first preset (Consumer TV). After that your last choice is kept, including off.

## Requirements

- Node 24 and pnpm
- `ffmpeg` and `ffprobe` on your `PATH` (`sudo apt install ffmpeg`)
- A GPU with WebGL2 and floating-point render targets (any reasonably recent GPU; without them the effects switch themselves off with a message)

## Install (beta)

On Debian, Ubuntu or Pop!_OS (x64):

```bash
curl -fsSL https://areimel.github.io/shader-video-player/install.sh | bash
```

The script downloads the newest `.deb` from [GitHub Releases](https://github.com/areimel/shader-video-player/releases), checks its SHA-256 and installs it with `apt` (which also installs `ffmpeg`). To do it by hand, download `shader-video-player_<version>_amd64.deb` from the release and run `sudo apt install ./shader-video-player_<version>_amd64.deb`. The app then appears in your application launcher, and `shader-video-player` runs it from a terminal. Remove it with `sudo apt remove shader-video-player`.

## Getting started (from source)

```bash
pnpm install
pnpm dev                 # run in development
pnpm dist                # build a .deb into release/
sudo apt install ./release/shader-video-player_0.3.0_amd64.deb
```

In development Electron is started with `--no-sandbox`, because the sandbox helper installed by the package manager is not setuid. The packaged `.deb` runs sandboxed.

### Keyboard shortcuts

Every shortcut is declared once in [`shared/commands.ts`](shared/commands.ts). Press `?` in the app to see the same list.

| Group | Command | Keys (Linux / Windows) |
|---|---|---|
| File | Open… | Ctrl+O |
| | Add to Queue… | Ctrl+Shift+O |
| | Close | Ctrl+W |
| | Screenshot | S, Ctrl+Shift+S |
| Playback | Play / Pause | Space |
| | Back 5 seconds | ← |
| | Forward 5 seconds | → |
| | Back 30 seconds | Shift+← |
| | Forward 30 seconds | Shift+→ |
| | Volume up | ↑ |
| | Volume down | ↓ |
| | Mute | M |
| | Slower | [ |
| | Faster | ] |
| | Previous | P |
| | Next | N |
| | Cycle loop mode | L |
| | Show remaining time | T |
| Subtitles | Subtitles earlier | G |
| | Subtitles later | H |
| Effects | Toggle effect | E |
| | Effects panel | Shift+E |
| View | Fullscreen | F |
| | Info | I |
| | Keyboard shortcuts | ? |

Shift+drop adds dropped files to the queue. Load Subtitle… and Picture in picture have no keyboard shortcut; use the menu or the controls.

On macOS the same shortcuts use ⌘ in place of Ctrl (Ctrl+O is ⌘O) and ⇧ in place of Shift. Linux is the supported platform.

Other commands: `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm check:shaders`, which compiles every shader pass on your GPU in a hidden window.

Environment variables:

| Variable | Purpose |
|---|---|
| `SVP_FFMPEG_PATH`, `SVP_FFPROBE_PATH` | Use specific ffmpeg/ffprobe binaries instead of the ones on `PATH` |
| `SVP_NO_HWDEC=1` | Disable the hardware video decode switches |

## How the CRT effect works

The video is not simply overlaid with lines. Each frame goes through a chain of shader passes:

1. **Raster** — the picture is resampled onto the tube's raster (240–576 scan lines), with overscan and colour controls.
2. **Signal** — the raster is carried over a simulated RGB, S-Video or composite connection. Composite modulates colour onto a subcarrier and decodes it again, which is what produces colour bleed, dot crawl and rainbowing.
3. **Linearize + persistence** — tube gamma, then phosphor afterglow from the previous frame.
4. **Glow and diffusion** — light spreading in and through the glass.
5. **Tube** — at full screen resolution: curvature, convergence, a per-channel electron beam whose width grows with brightness, the phosphor mask (aperture grille, slot or shadow mask) locked to your display's pixels, brightness compensation, vignette, reflection and noise.

Only the last step runs at screen resolution; the rest work on the small raster, which keeps the effect affordable. Scanlines fade out automatically when the window is too small to show them cleanly (below about 2.5 screen pixels per line), so they are most visible at 1080p and above.

Every parameter is declared once in `renderer/shader/effects/<effect>/params.ts` (tube parameters in `effects/shared/tube/params.ts`); the settings panel, shader uniforms, presets and saved settings are all generated from that table.

## How the VHS effect works

The VHS effect records the picture to a simulated tape and plays it back, adding the tape's faults on the way. Every pass works on a tape raster of 240 or 480 lines:

1. **Frame** — the video is fitted to the tape raster, converted to luma and chroma, and given saturation and tint. The camcorder date stamp is drawn here, so it is recorded too.
2. **Tape, horizontal** — luma is band-limited to about 3 MHz at SP (less at LP and EP, and in later generations), with edge sharpening that leaves halos. Colour is limited to about 0.4 MHz and delayed to the right, as on a colour-under recording. Luma and chroma noise is added, along with time-base errors: line jitter, slow wobble, a bend at the top of the picture and a shift in the head-switch band.
3. **Tape, vertical** — chroma is smeared across neighbouring lines by the deck's one-line comb, dropouts are added as white streaks, and the head-switch and tracking bands get extra noise. The VCR on-screen display (play symbol, tape speed, counter) is drawn here.
4. **Composite** (optional) — with Output set to Composite (the default) the signal is encoded as NTSC composite and decoded again, which produces dot crawl and rainbowing. Y/C (S-Video) skips this step.
5. **TV** (optional, off by default) — the picture is shown on a simulated tube using the same beam, mask, glow and geometry code as the CRT effect. With the TV off, the picture is drawn flat, as on a capture card.

Presets, in the order they appear in the dropdown:

- Home recording (SP), the default for new users
- Worn rental
- Six-hour EP
- Camcorder (date stamp)
- VCR on a TV
- Third-generation dub
- Bad tracking

The camcorder and VCR-on-a-TV presets turn the on-screen display on; the others leave it off. Framing is one of Keep aspect (the default), 4:3 crop or 4:3 letterbox. The effect changes the picture only; audio is untouched. It models NTSC only, with no PAL or SECAM.

## Project layout

```
electron/                  main process: windows, IPC, local-file protocol, play queue
electron/media/            ffprobe, ffmpeg transcode sessions, subtitle conversion
renderer/                  React UI (components, hooks, styles)
renderer/shader/gl/        small WebGL2 multi-pass engine
renderer/shader/glsl/      shared GLSL chunks
renderer/shader/effects/   effect definitions (crt/, vhs/) and effects/shared/ (tube stage, NTSC timing)
shared/                    types and helpers shared by both processes
tests/                     unit tests and the shader compile check
scripts/                   dev, build and shader-check scripts
docs/superpowers/specs/    design documents
website/                   Astro product site (CRT-TV), its own pnpm workspace; see below
.github/workflows/         CI (typecheck + tests on push/PR) and the manual website deploy
AGENTS.md                  short contributor guide
TODO.md                    publishing tasks and wish list
```

See `CLAUDE.md` for the conventions used in this codebase, the security model and how to verify rendering from the command line.

## Known limitations

- Linux only for now; no Windows or macOS builds.
- SDR output only. HDR files play, but tone-mapped by the browser engine.
- Drawing through shaders uses more GPU and power than plain playback; 4K performance has not been measured yet.
- Files that need a full video transcode (for example HEVC without hardware decoding) are CPU-heavy, and seeking in them restarts the conversion.
- Image-based subtitles (PGS, VobSub) are not supported, and `.ass` styling is dropped.
- Whether hardware video decoding engages depends on your GPU and drivers; set `SVP_NO_HWDEC=1` if it misbehaves.

## Roadmap

1. Tune the CRT presets against real footage.
2. Performance measurements and a quality toggle for integrated GPUs.
3. Wish list: export a video with the effect applied, ideally from the command line too.

## Credits and licence

MIT — see [LICENSE](LICENSE).

The player is based on [babu-video-player](https://github.com/babu-studios/babu-video-player) by Babu Studios (MIT). Shader techniques draw on published work credited in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). ffmpeg is used as an external program and is not bundled. The interface typeface, Archivo, and the home screen's pixel face, Press Start 2P (both SIL Open Font License 1.1), are bundled so the app works offline.

## Product website

The product site lives in [`website/`](website/README.md): a static [Astro](https://astro.build) site branded **CRT-TV** with Home, Download, Docs and Contact pages, a launch-update signup and a contact form. The CRT-TV name is used on the site only; the desktop app is still Shader Video Player.

The site has its own pnpm workspace and lockfile, separate from the desktop app's:

```bash
pnpm --dir website install --frozen-lockfile
cp website/.env.example website/.env      # set PUBLIC_WEB3FORMS_ACCESS_KEY to enable the forms
pnpm --dir website dev --background       # http://localhost:4321/shader-video-player/
pnpm --dir website check                  # Astro type check
pnpm --dir website build                  # static output in website/dist
pnpm --dir website test:browser           # Playwright: desktop/mobile layouts, links, forms (mocked)
```

The forms post to [Web3Forms](https://web3forms.com/) with a public access key; without a key they show as unavailable. Deployment to GitHub Pages runs only when you start the **Deploy CRT-TV website** workflow by hand. The Download page's install command runs `website/public/install.sh`, which installs the newest `.deb` from GitHub Releases. See [`website/README.md`](website/README.md) for setup, Pages configuration and editing notes.
