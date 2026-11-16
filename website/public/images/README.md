# CRT-TV website captures

All screenshots are authentic captures of the current desktop app. The media shown is an ffmpeg-generated SMPTE test pattern; no third-party footage is included. Desktop branding remains unchanged.

- `home.webp`: home menu, folder library, and CRT preset selection; Consumer TV preset.
- `crt.webp`: Consumer TV (composite) effect applied to test bars, with the current effects panel open.
- `vhs.webp`: Home recording (SP) VHS effect applied to the same test bars.

Images are 1440 × 1080. Original PNGs are available in this working directory. WebP copies use quality 85.

Capture used a scratch profile under `/tmp/crt-tv-assets/ud`, so no personal library or settings were captured. Because the desktop compositor resized visible windows, final captures used Electron's headless Ozone backend with SwiftShader. This runs the real app shaders and is not a statement about hardware performance.

Synthetic source:

```sh
ffmpeg -f lavfi -i 'smptebars=size=1440x1080:rate=30' -t 30 -c:v libx264 -pix_fmt yuv420p Broadcast-test.mp4
```
