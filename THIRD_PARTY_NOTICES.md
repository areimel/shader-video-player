# Third-party notices

## FFmpeg

Shader Video Player does not bundle FFmpeg. At runtime it runs the system `ffmpeg` and `ffprobe` programs
(https://ffmpeg.org) found on `PATH` (the `.deb` declares `ffmpeg` as a dependency), or the paths given in
the `SVP_FFMPEG_PATH` and `SVP_FFPROBE_PATH` environment variables. They run as separate processes and are
covered by their own licenses (LGPL/GPL depending on your distribution's build). FFmpeg is a trademark of
Fabrice Bellard.

## babu-video-player

This project is based on babu-video-player, MIT licensed, Copyright Babu Studios.

## Archivo

The interface typeface is Archivo, distributed through `@fontsource-variable/archivo` and bundled with the app.

> Copyright 2020 The Archivo Project Authors (https://github.com/Omnibus-Type/Archivo)

Licensed under the SIL Open Font License, Version 1.1 (https://openfontlicense.org). The full licence text ships
with the package as `node_modules/@fontsource-variable/archivo/LICENSE`.

## Electron, Chromium, React

Electron and Chromium are distributed under the MIT and BSD-style licenses; their notices ship in the app
bundle (`LICENSE`, `LICENSES.chromium.html`). React is MIT licensed.
