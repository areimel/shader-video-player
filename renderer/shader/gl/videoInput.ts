import type { FrameInput, FrameInputEvents, FrameTick } from "./frameInput";

/** The player's frame input: everything the engine needs to know about a <video>, and nothing more. */
export function videoInput(video: HTMLVideoElement): FrameInput {
  // Media time of the last presented frame: while playing, currentTime runs ahead of the picture on screen.
  let lastFrameMediaTime = 0;
  const playing = () => !video.paused && !video.ended;

  return {
    image: video,
    size: () => (video.videoWidth > 0 ? { width: video.videoWidth, height: video.videoHeight } : null),
    ready: () => video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth !== 0,

    subscribe(onFrame: (tick: FrameTick) => void): () => void {
      let running = true;
      let callbackId = 0;
      const tick = (_now: number, meta: VideoFrameCallbackMetadata) => {
        lastFrameMediaTime = meta.mediaTime;
        onFrame({ image: true });
        if (running) callbackId = video.requestVideoFrameCallback(tick);
      };
      callbackId = video.requestVideoFrameCallback(tick);
      return () => {
        running = false;
        video.cancelVideoFrameCallback(callbackId);
      };
    },

    playing,
    time: () => (playing() ? lastFrameMediaTime : video.currentTime),

    listen(h: FrameInputEvents): () => void {
      const wiring: Array<[string, () => void]> = [
        ["seeked", () => h.onJump()],
        ["play", () => h.onPlayState()],
        ["pause", () => h.onPlayState()],
        // The decoded size can change mid-stream (adaptive or concatenated sources).
        ["resize", () => h.onResized()],
        ["loadeddata", () => h.onResized()],
      ];
      for (const [type, fn] of wiring) video.addEventListener(type, fn);
      return () => { for (const [type, fn] of wiring) video.removeEventListener(type, fn); };
    },
  };
}
