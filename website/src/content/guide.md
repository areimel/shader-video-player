## Before you tune in

CRT-TV is in public beta. Install it with the one-line command on the Download page, or download the `.deb` from GitHub Releases. In your app launcher it appears as **Shader Video Player**.

The beta runs on **Linux x64**, on Wayland or X11. You will need `ffmpeg` and `ffprobe` installed and available on your PATH, plus a GPU that supports WebGL2 and floating-point render targets for the effects. The installer pulls in ffmpeg; otherwise `sudo apt install ffmpeg` installs it. Node and pnpm are needed only when building the app from source.

## Open your first video

Press **Ctrl+O** to choose a local video, or drop one into the player. MP4, MKV, WebM, MOV, and AVI are among the supported containers. When the browser engine cannot decode a file directly, the app uses ffmpeg to convert it during playback. Only local video files are supported; images, playlists, and network streams are not.

Use **Add library folder** or drop a folder onto the home screen to build your library. The player lists videos with their duration and file size, watches those folders for changes, and remembers playback positions. Press **Ctrl+W** to return home.

## Open a link

Press **Ctrl+U** (File menu: **Open URL…**) and paste a link to a video, such as a YouTube page. The app downloads it with **yt-dlp** into `~/Videos/Shader Video Player`, adds that folder to your library, and starts playing it. Other sites that yt-dlp supports work too.

yt-dlp is not built into the app. Install it with `sudo apt install yt-dlp` or `pipx install yt-dlp`. The `.deb` recommends it, so apt usually installs it for you. Downloads are for your own use; respect the terms of the site you take them from.

## Settle in for a double feature

Open or drop several files to create a play queue. **Ctrl+Shift+O** or **Shift+drop** adds videos to the current queue. Use **N** and **P** to move between videos, and **L** to cycle between no loop, loop all, and loop one. The queue advances automatically when a video ends.

Playback controls also offer speed and audio-track selection. Picture-in-picture is available from the menu or controls; **F** toggles fullscreen.

## Find your picture

Press **Shift+E** to open the effects panel. Choose CRT or VHS from the effect selector, pick a preset, then adjust the controls to taste. Your settings are remembered between runs. Press **E** to switch the active effect off or on.

CRT presets cover four starting points: **Consumer TV (composite)**, **Trinitron (S-Video)**, **Arcade monitor (RGB)**, and **Broadcast monitor (PVM)**. Tune scanlines, phosphor masks, glow, curvature, and signal artifacts. Scanlines become less pronounced in small windows so they do not turn into distracting aliasing.

VHS has seven presets: **Home recording (SP)**, **Worn rental**, **Six-hour EP**, **Camcorder (date stamp)**, **VCR on a TV**, **Third-generation dub**, and **Bad tracking**. Choose Keep aspect, 4:3 crop, or 4:3 letterbox framing. The optional TV stage adds a simulated tube to the tape picture. VHS changes the picture only; audio stays untouched. The simulation models NTSC, not PAL or SECAM.

## Smooth out the stutter

Some files have to be converted live while they play. An HEVC video with AC3 audio in an MKV is a common example, and seeking in one can stutter. Choose **Convert for smooth playback** from the File menu to convert the file once. The app writes an `.svp.mp4` copy next to the original and plays that copy from then on. The original is left alone, so make sure there is enough free disk space for the new file.

## Subtitles and keepsakes

Select an embedded subtitle track or use **Load Subtitle** for an external `.srt`, `.vtt`, or `.ass` file. A subtitle file with the same name as the video is picked up automatically. Subtitles stay sharp above the effect; adjust their size and timing in the player. **G** moves subtitles earlier and **H** moves them later. Image-based PGS and VobSub tracks are unsupported, and ASS styling is not preserved.

Press **S** or **Ctrl+Shift+S** to save the current video frame as a PNG with the active effect applied.

## Export with the effect

Press **Ctrl+E** (File menu: **Export with effect…**) to render the current video through the active effect and its settings into an MP4 file. The default size matches the source, raised to at least 1080 pixels tall if the source is smaller. An export takes longer than the video itself, so start it and let the computer work.

## Command line

The `shader-video-player` command does a few jobs without opening the player. Run `shader-video-player help` for a summary.

| Command | What it does |
| --- | --- |
| `shader-video-player download <url> [--no-play]` | Downloads a link as **Open URL…** does, and plays it unless you add `--no-play`. |
| `shader-video-player convert <file> [-o out.mp4] [--force]` | Makes the `.svp.mp4` smooth-playback copy. `--force` replaces an existing copy. |
| `shader-video-player export <file> [--effect crt\|vhs] [--preset <id>] [--settings file.json] [--size 1920x1080] [-o out.mp4]` | Renders a video through an effect, with a progress bar and time left. No window opens, but it needs a desktop session with a GPU. |
| `shader-video-player update [--check]` | Checks GitHub for a newer release. Without `--check` it installs the release with apt and asks for your password. |
| `shader-video-player help` / `--version` | Shows the command summary or the installed version. |

The export `--preset` ids are listed below. Without `--preset`, the effect starts from its first preset.

| Effect | Preset id | Name |
| --- | --- | --- |
| `crt` | `composite-tv` | Consumer TV (composite) |
| `crt` | `trinitron` | Trinitron (S-Video) |
| `crt` | `arcade` | Arcade monitor (RGB) |
| `crt` | `pvm` | Broadcast monitor (PVM) |
| `vhs` | `home-sp` | Home recording (SP) |
| `vhs` | `rental` | Worn rental |
| `vhs` | `ep` | Six-hour EP |
| `vhs` | `camcorder` | Camcorder (date stamp) |
| `vhs` | `vcr-tv` | VCR on a TV |
| `vhs` | `dub` | Third-generation dub |
| `vhs` | `tracking` | Bad tracking |

## Keep the remote handy

| Action | Shortcut |
| --- | --- |
| Open a video | Ctrl+O |
| Add to queue | Ctrl+Shift+O |
| Open URL | Ctrl+U |
| Export with effect | Ctrl+E |
| Return home | Ctrl+W |
| Play / pause | Space |
| Seek 5 seconds | Left / Right arrow |
| Seek 30 seconds | Shift+Left / Right arrow |
| Adjust volume | Up / Down arrow |
| Mute | M |
| Slower / faster | [ / ] |
| Previous / next video | P / N |
| Cycle loop mode | L |
| Toggle remaining time | T |
| Toggle effect | E |
| Open effects panel | Shift+E |
| Save screenshot | S or Ctrl+Shift+S |
| Subtitles earlier / later | G / H |
| Fullscreen | F |
| File information | I |
| Full shortcut guide | ? |

These are playback shortcuts. Home-screen navigation uses its own menu controls. Press **Escape** to dismiss an open overlay.

## When the signal needs a little help

**A video will not open.** Check that it is a real local video and that both `ffmpeg` and `ffprobe` are on PATH. Some files require conversion, which can take more CPU and restart when you seek. Use **Convert for smooth playback** to convert them once.

**Effects turn themselves off.** The app falls back to plain playback if the required GPU features are unavailable. Check your graphics drivers and WebGL2 support.

**Playback feels heavy.** Press E to try plain playback. Shader effects require more GPU power, and a full video conversion can be CPU-intensive. 4K performance has not been measured yet.

**Hardware decoding misbehaves.** Advanced users can launch the app with `SVP_NO_HWDEC=1` to disable its hardware decode switches. Hardware decoding depends on your GPU and drivers.

**The picture differs from your original.** Output is SDR; HDR is not preserved. CRT and VHS presets are still being tuned against more footage, so treat them as starting points.
