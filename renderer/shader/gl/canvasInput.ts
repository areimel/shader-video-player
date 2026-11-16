import type { CanvasInput, FrameInputEvents, FrameTick } from "./frameInput";
import { InputClock } from "./inputClock";
import type { Size } from "./passTypes";

/**
 * A 2D canvas as an effect source (the home screen). The owner calls `painted()` after each redraw, which
 * uploads it. Between paints a ~30 Hz counter-only tick keeps `uVideoFrame` moving (dot crawl, interlace bob)
 * without re-uploading or rebuilding mips. It counts as "playing" only while the window is visible and focused,
 * so an idle background window stops the render loop and costs no GPU time.
 */
export function canvasInput(canvas: HTMLCanvasElement, opts: { fps?: number } = {}): CanvasInput {
  const clock = new InputClock(opts.fps ?? 30);
  const frameSubs = new Set<(tick: FrameTick) => void>();
  const eventSubs = new Set<FrameInputEvents>();
  let everPainted = false;
  let paintedSize: Size | null = null;
  let playing = false;
  let attached = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastTickFrame = -1;
  let disposed = false;

  const windowActive = () => document.visibilityState === "visible" && document.hasFocus();
  const size = (): Size | null => (canvas.width > 0 && canvas.height > 0 ? { width: canvas.width, height: canvas.height } : null);
  const emit = (tick: FrameTick) => { for (const fn of [...frameSubs]) fn(tick); };

  const tick = () => {
    // Driven by the clock, not by the timer count: a late or doubled timer neither skips ahead nor repeats.
    const frame = clock.frame(performance.now());
    if (frame === lastTickFrame) return;
    lastTickFrame = frame;
    emit({ image: false });
  };

  const updateTimer = () => {
    const wanted = playing && frameSubs.size > 0;
    if (wanted && timer === null) timer = setInterval(tick, 1000 / clock.fps);
    if (!wanted && timer !== null) { clearInterval(timer); timer = null; }
  };

  /** Re-reads visibility/focus; pauses or resumes the clock and reports a flip. */
  const sync = () => {
    const next = attached && windowActive();
    if (next === playing) return updateTimer();
    playing = next;
    const now = performance.now();
    if (playing) clock.resume(now); else clock.pause(now);
    updateTimer();
    for (const h of [...eventSubs]) h.onPlayState();
  };

  // Listeners exist only while someone is subscribed: with no subscribers nothing runs at all.
  const updateAttachment = () => {
    const wanted = !disposed && (frameSubs.size > 0 || eventSubs.size > 0);
    if (wanted === attached) return updateTimer();
    attached = wanted;
    const method = wanted ? "addEventListener" : "removeEventListener";
    document[method]("visibilitychange", sync);
    window[method]("focus", sync);
    window[method]("blur", sync);
    sync();
  };

  return {
    image: canvas,
    size,
    ready: () => everPainted,

    subscribe(onFrame) {
      if (disposed) return () => {};
      frameSubs.add(onFrame);
      updateAttachment();
      return () => { frameSubs.delete(onFrame); updateAttachment(); };
    },

    listen(handlers) {
      if (disposed) return () => {};
      eventSubs.add(handlers);
      updateAttachment();
      return () => { eventSubs.delete(handlers); updateAttachment(); };
    },

    // While nobody listens there is no event to learn about a flip from, so answer from the window directly.
    playing: () => (attached ? playing : windowActive()),
    time: () => clock.elapsed(performance.now()),

    painted() {
      if (disposed) return;
      everPainted = true;
      const s = size();
      // A new size (or the first paint) needs fresh derived values before the upload that the tick asks for.
      if (s?.width !== paintedSize?.width || s?.height !== paintedSize?.height) {
        paintedSize = s;
        for (const h of [...eventSubs]) h.onResized();
      }
      emit({ image: true });
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      frameSubs.clear();
      eventSubs.clear();
      updateAttachment();
      clock.pause(performance.now());
    },
  };
}
