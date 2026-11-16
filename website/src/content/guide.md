## Before you tune in

CRT-TV is in development. A public installer is not available yet; the command on the Download page is a placeholder.

The first release targets **Linux x64**, on Wayland or X11. You will need `ffmpeg` and `ffprobe` installed and available on your PATH, plus a GPU that supports WebGL2 and floating-point render targets for the effects. On Debian or Ubuntu, `sudo apt install ffmpeg` installs the media tools. Node and pnpm are needed only when building the app from source.

## Open your first video

Press **Ctrl+O** to choose a local video, or drop one into the player. MP4, MKV, WebM, MOV, and AVI are among the supported containers. When the browser engine cannot decode a file directly, the app uses ffmpeg to convert it during playback. Only local video files are supported; images, playlists, and network streams are not.

Use **Add library folder** or drop a folder onto the home screen to build your library. The player lists videos with their duration and resolution, watches those folders for changes, and remembers playback positions. Press **Ctrl+W** to return home.

## Settle in for a double feature

Open or drop several files to create a play queue. **Ctrl+Shift+O** or **Shift+drop** adds videos to the current queue. Use **N** and **P** to move between videos, and **L** to cycle between no loop, loop all, and loop one. The queue advances automatically when a video ends.

Playback controls also offer speed and audio-track selection. Picture-in-picture is available from the menu or controls; **F** toggles fullscreen.

## Find your picture

Press **Shift+E** to open the effects panel. Choose CRT or VHS from the effect selector, pick a preset, then adjust the controls to taste. Your settings are remembered between runs. Press **E** to switch the active effect off or on.

CRT presets cover four starting points: **Consumer TV (composite)**, **Trinitron (S-Video)**, **Arcade monitor (RGB)**, and **Broadcast monitor (PVM)**. Tune scanlines, phosphor masks, glow, curvature, and signal artifacts. Scanlines become less pronounced in small windows so they do not turn into distracting aliasing.

VHS has seven presets: **Home recording (SP)**, **Worn rental**, **Six-hour EP**, **Camcorder (date stamp)**, **VCR on a TV**, **Third-generation dub**, and **Bad tracking**. Choose Keep aspect, 4:3 crop, or 4:3 letterbox framing. The optional TV stage adds a simulated tube to the tape picture. VHS changes the picture only; audio stays untouched. The simulation models NTSC, not PAL or SECAM.

## Subtitles and keepsakes

Select an embedded subtitle track or use **Load Subtitle** for an external `.srt`, `.vtt`, or `.ass` file. A subtitle file with the same name as the video is picked up automatically. Subtitles stay sharp above the effect; adjust their size and timing in the player. **G** moves subtitles earlier and **H** moves them later. Image-based PGS and VobSub tracks are unsupported, and ASS styling is not preserved.

Press **S** or **Ctrl+Shift+S** to save the current video frame as a PNG with the active effect applied.

## Keep the remote handy

| Action | Shortcut |
| --- | --- |
| Open a video | Ctrl+O |
| Add to queue | Ctrl+Shift+O |
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

**A video will not open.** Check that it is a real local video and that both `ffmpeg` and `ffprobe` are on PATH. Some files require conversion, which can take more CPU and restart when you seek.

**Effects turn themselves off.** The app falls back to plain playback if the required GPU features are unavailable. Check your graphics drivers and WebGL2 support.

**Playback feels heavy.** Press E to try plain playback. Shader effects require more GPU power, and a full video conversion can be CPU-intensive. 4K performance has not been measured yet.

**Hardware decoding misbehaves.** Advanced users can launch the app with `SVP_NO_HWDEC=1` to disable its hardware decode switches. Hardware decoding depends on your GPU and drivers.

**The picture differs from your original.** Output is SDR; HDR is not preserved. CRT and VHS presets are still being tuned against more footage, so treat them as starting points.
