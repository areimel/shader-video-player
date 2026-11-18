import { ipcMain } from "electron";
import { currentVideoPath } from "../playback";
import { probeFile } from "../media/probe";
import { validAudioOrdinal } from "../media/audioOrdinal";
import { startConvert } from "./convert";

/** Resolves to the job id. The source is the file main has open; the renderer never sends a path. */
export function registerConvertIpc(): void {
  ipcMain.handle("convert:start", async (_e, audioOrdinal: unknown): Promise<string | null> => {
    const path = currentVideoPath();
    if (!path) throw new Error("Open a video first");
    const info = await probeFile(path);
    if (!validAudioOrdinal(audioOrdinal, info.audioTracks)) throw new Error("Invalid audio track");
    return startConvert(info, audioOrdinal).id;
  });
}
