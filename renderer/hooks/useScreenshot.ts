import { useCallback, useRef, type MutableRefObject, type RefObject } from "react";
import type { PlaybackPlan, ToastKind } from "../types/player";
import { screenshotName, videoFrameToBlob } from "../utils/capture";

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** The same ref passed to <ShaderCanvas captureRef>; non-null only while an effect is active. */
  captureRef: MutableRefObject<(() => Promise<Blob>) | null>;
  plan: PlaybackPlan | null;
  /** Current playback time in seconds (source time, used only for the file name). */
  timeSec: number;
  notify: (kind: ToastKind, msg: string) => void;
}

/** Saves the current frame (with the active effect, if any) as a PNG through the main process. */
export function useScreenshot({ videoRef, captureRef, plan, timeSec, notify }: Options): () => Promise<void> {
  const latest = useRef({ plan, timeSec, notify });
  latest.current = { plan, timeSec, notify };
  return useCallback(async () => {
    const { plan: p, timeSec: t, notify: say } = latest.current;
    const video = videoRef.current;
    if (!p || !video) return;
    try {
      const blob = await (captureRef.current ? captureRef.current() : videoFrameToBlob(video));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const saved = await window.player.saveScreenshot(bytes, screenshotName(p.info.name, t));
      if (saved) say("success", "Saved screenshot");
    } catch (e) {
      say("error", e instanceof Error ? e.message : String(e));
    }
  }, [videoRef, captureRef]);
}
