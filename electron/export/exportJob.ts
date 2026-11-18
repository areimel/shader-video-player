import type { ChildProcess } from "node:child_process";
import { rename, rm } from "node:fs/promises";
import type { MediaInfo } from "../../shared/types";
import { ffmpegPath } from "../media/binaries";
import { partPath } from "../media/outputName";
import { killProcess, spawnTracked, tailLines } from "../media/processes";
import { startJob } from "../jobs/registry";
import type { Job } from "../jobs/job";
import { decodeArgs, encodeArgs, fpsOf, frameCount, type Size } from "./exportArgs";
import { createExportPage } from "./exportWindow";
import { FrameChunker } from "./frameChunker";

export interface ExportOptions {
  path: string;
  info: MediaInfo;
  settings: { effectId?: string; presetId?: string | null; raw?: unknown };
  size: Size;
  audioOrdinal: number;
  out: string;
}

/** Frames handed to the page at once: one rendering while the next one's pixels travel back. */
const MAX_IN_FLIGHT = 2;

/**
 * decoder ffmpeg -> hidden render page -> encoder ffmpeg. Back pressure: the decoder is paused while
 * two frames are in the page and while the encoder's stdin buffer is full.
 */
export function startExport(opts: ExportOptions): Job {
  return startJob("export", `Export ${opts.info.name}`, (job) => run(job, opts));
}

async function run(job: Job, { path, info, settings, size, audioOrdinal, out }: ExportOptions): Promise<void> {
  const fps = fpsOf(info);
  const total = frameCount(info.durationSec, fps);
  const part = partPath(out);
  const source: Size = { width: info.width, height: info.height };
  const frameBytes = source.width * source.height * 4;

  const page = createExportPage();
  const children: ChildProcess[] = [];
  let finish: () => void = () => {};
  job.onCancel(() => {
    page.close();
    children.forEach(killProcess);
    finish();
    void rm(part, { force: true });
  });

  let ok = false;
  try {
    job.report(null, "starting");
    await page.ready;
    if (job.finished) return;
    page.init({ effectId: settings.effectId, presetId: settings.presetId, raw: settings.raw, sourceSize: source, outputSize: size, fps });

    const decoder = spawnTracked(ffmpegPath(), decodeArgs(path, fps), { stdout: true });
    const encoder = spawnTracked(ffmpegPath(), encodeArgs(info, audioOrdinal, size, fps, part), { stdin: true });
    children.push(decoder, encoder);
    const decoderErr = tailLines(decoder.stderr!);
    const encoderErr = tailLines(encoder.stderr!);
    const lastLine = (tail: () => string[], fallback: string) => tail().filter(Boolean).pop() ?? fallback;

    await new Promise<void>((resolve, reject) => {
      finish = resolve;
      let sent = 0;
      let returned = 0;
      let decoderDone = false;
      let encoderBlocked = false;
      let encoderEnded = false;
      const queue: Uint8Array[] = [];

      const stdin = encoder.stdin!;
      const inFlight = () => sent - returned;
      const checkResume = () => {
        if (!decoderDone && queue.length === 0 && inFlight() < MAX_IN_FLIGHT && !encoderBlocked) decoder.stdout!.resume();
      };
      const sendNext = (frame: Uint8Array) => { page.sendFrame(sent++, frame); };
      const chunker = new FrameChunker(frameBytes, (frame) => {
        if (inFlight() < MAX_IN_FLIGHT && queue.length === 0) sendNext(frame);
        else queue.push(frame.slice()); // the chunker reuses its buffers
        if (inFlight() >= MAX_IN_FLIGHT || queue.length) decoder.stdout!.pause();
      });

      const maybeEnd = () => {
        if (!decoderDone || returned < sent || queue.length || encoderEnded) return;
        encoderEnded = true;
        page.end();
        stdin.end();
      };

      page.onError((m) => reject(new Error(m)));
      page.onPixels((n, bytes) => {
        if (n !== returned) return reject(new Error("Export frames came back out of order"));
        returned++;
        job.report(Math.min(0.99, returned / total), "rendering");
        if (!stdin.write(bytes)) {
          encoderBlocked = true;
          decoder.stdout!.pause();
          stdin.once("drain", () => { encoderBlocked = false; checkResume(); });
        }
        while (queue.length && inFlight() < MAX_IN_FLIGHT) sendNext(queue.shift()!);
        checkResume();
        maybeEnd();
      });

      decoder.stdout!.on("data", (chunk: Buffer) => chunker.push(chunk));
      decoder.on("error", reject);
      decoder.on("close", (code) => {
        if (job.finished) return;
        if (code !== 0) return reject(new Error(lastLine(decoderErr, `ffmpeg exited with ${code}`)));
        decoderDone = true;
        maybeEnd();
      });
      stdin.on("error", () => { /* the encoder died: its close handler reports why */ });
      encoder.on("error", reject);
      encoder.on("close", (code) => {
        if (job.finished) return;
        if (code === 0 && encoderEnded) return resolve();
        reject(new Error(lastLine(encoderErr, `ffmpeg exited with ${code}`)));
      });
    });
    if (job.finished) return;
    await rename(part, out);
    ok = true;
    job.succeed(out, ["open", "reveal"]);
  } finally {
    page.close();
    children.forEach(killProcess);
    if (!ok) await rm(part, { force: true });
  }
}
