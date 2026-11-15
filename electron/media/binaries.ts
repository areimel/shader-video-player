import { app } from "electron";

/** Packaged builds unpack binaries out of the asar archive. */
function fix(p: string): string {
  return p.replace("app.asar", "app.asar.unpacked");
}

// SVP_FFMPEG_PATH / SVP_FFPROBE_PATH let a release ship an LGPL build.
export function ffmpegPath(): string {
  if (process.env.SVP_FFMPEG_PATH) return process.env.SVP_FFMPEG_PATH;
  if (app.isPackaged) return `${process.resourcesPath}/bin/ffmpeg`;
  return fix(require("ffmpeg-static") as string);
}

export function ffprobePath(): string {
  if (process.env.SVP_FFPROBE_PATH) return process.env.SVP_FFPROBE_PATH;
  if (app.isPackaged) return `${process.resourcesPath}/bin/ffprobe`;
  return fix((require("ffprobe-static") as { path: string }).path);
}
