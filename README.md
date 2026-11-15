# Shader Video Player

A desktop video player that plays your files through real-time shader effects. The first effect is a physically inspired **CRT television**: scanline beams, phosphor masks, glow, tube curvature and analog composite/S-Video signal artefacts, with presets and a control for every parameter. A VHS effect is planned next.

Built on Electron, React and WebGL2. Linux (Wayland/X11) is the supported platform for now.

> Status: early development.

## Features

- Plays MP4, MKV, WebM, MOV, AVI and more. Formats Chromium cannot decode (HEVC, AC3/DTS audio, AVI…) are converted on the fly with ffmpeg.
- Open dialog, drag and drop, recent files, resume position, playback speed, audio track and subtitle selection, fullscreen, picture-in-picture, keyboard shortcuts.
- CRT effect with four presets: Consumer TV (composite), Trinitron (S-Video), Arcade monitor (RGB), Broadcast monitor (PVM).
- Effects can be switched off instantly; with no effect active the video plays through the normal, low-power path.

## Requirements

- Node 24 and pnpm
- `ffmpeg` and `ffprobe` on your `PATH` (`sudo apt install ffmpeg`)
- A GPU with WebGL2

## Getting started

```bash
pnpm install
pnpm dev                 # run in development
pnpm dist                # build a .deb into release/
```

Other commands: `pnpm typecheck`, `pnpm test`, `pnpm check:shaders`, `pnpm build`.

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

Every parameter is declared once in `renderer/shader/effects/crt/params.ts`; the settings panel, shader uniforms, presets and saved settings are all generated from that table.

## Project layout

```
electron/                  main process, local-file protocol, ffmpeg sessions
renderer/                  React UI
renderer/shader/gl/        small WebGL2 multi-pass engine
renderer/shader/effects/   effect definitions (crt/)
shared/                    IPC types
tests/                     unit tests
docs/superpowers/specs/    design documents
```

See `CLAUDE.md` for the conventions used in this codebase.

## Credits and licence

MIT — see [LICENSE](LICENSE).

The player is based on [babu-video-player](https://github.com/babu-studios/babu-video-player) by Babu Studios (MIT). Shader techniques draw on published work credited in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). ffmpeg is used as an external program and is not bundled.
