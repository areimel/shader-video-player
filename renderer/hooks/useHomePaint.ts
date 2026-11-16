import { useCallback, useEffect, useRef, type RefObject } from "react";
import { fontSpec, FONT_PX, homeContext, paint, readColors, type HomeColors } from "../components/home/painter";
import { canvasInput } from "../shader/gl/canvasInput";
import type { CanvasInput } from "../shader/gl/frameInput";
import { formatClock, msToNextMinute, sameOps } from "../utils/home/frame";
import { layout } from "../utils/home/layout";
import { onWindowActivity, windowActive } from "../utils/windowActivity";
import { useLatest } from "./useLatest";
import type { DrawOp, HomeFrame, HomeModel, HomeState } from "../utils/home/types";

/** Wake a little after the change so the layout is certainly past the boundary. */
const WAKE_SLACK_MS = 5;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

interface Options {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  model: HomeModel;
  state: HomeState;
}

export interface HomePaint {
  /** The last laid-out frame (its hit regions drive the pointer). */
  frameRef: RefObject<HomeFrame | null>;
  /** Stable factory for useEffectChain: the 2D canvas as an effect input (created on first use, one per mount). */
  makeInput: () => CanvasInput | null;
}

/**
 * Paints the home screen on its 2D canvas: on every state/model change, once a minute for the clock, and once
 * at the moment the layout says something changes with time (the next marquee step or updates page), only while
 * the window is visible and focused. A paint that would draw the same ops is skipped, so the effect only
 * re-uploads the canvas when pixels change. Nothing paints before the pixel font has loaded.
 */
export function useHomePaint({ canvasRef, model, state }: Options): HomePaint {
  const frameRef = useRef<HomeFrame | null>(null);
  const inputRef = useRef<CanvasInput | null>(null);
  const latest = useLatest({ model, state });
  const repaintRef = useRef<() => void>(() => {});

  const makeInput = useCallback(() => {
    if (!inputRef.current && canvasRef.current) inputRef.current = canvasInput(canvasRef.current);
    return inputRef.current;
  }, [canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas && homeContext(canvas);
    if (!canvas || !ctx) return;
    const colors: HomeColors = readColors(canvas);
    const started = performance.now();
    const motion = window.matchMedia(REDUCED_MOTION);
    let fontReady = false;
    let disposed = false;
    let painted: DrawOp[] | null = null;
    let cursorKey = "";
    let cursorSince = 0;
    let tick: ReturnType<typeof setTimeout> | undefined;
    let minute: ReturnType<typeof setTimeout> | undefined;

    const repaint = () => {
      clearTimeout(tick);
      if (!fontReady || disposed) return;
      const { model, state } = latest.current;
      const elapsed = (performance.now() - started) / 1000;
      const key = `${state.zone}:${model.zones[state.zone][state.cursor[state.zone]]?.id ?? ""}`;
      if (key !== cursorKey) { cursorKey = key; cursorSince = elapsed; }
      const clock = { timeText: formatClock(new Date()), elapsed, cursorSince, reducedMotion: motion.matches };
      const frame = layout(model, state, clock);
      frameRef.current = frame;
      if (!sameOps(painted, frame.ops)) {
        paint(ctx, frame, colors);
        painted = frame.ops;
        makeInput()?.painted();
      }
      if (frame.nextChange !== null && windowActive()) tick = setTimeout(repaint, frame.nextChange * 1000 + WAKE_SLACK_MS);
    };
    const everyMinute = () => { repaint(); minute = setTimeout(everyMinute, msToNextMinute(new Date())); };
    repaintRef.current = repaint;

    void Promise.all([document.fonts.load(fontSpec(FONT_PX)), document.fonts.load(fontSpec(FONT_PX * 2))])
      .catch(() => undefined) // a missing font still paints, with the fallback face
      .then(() => {
        if (disposed) return;
        fontReady = true;
        everyMinute();
      });
    motion.addEventListener("change", repaint);
    const offActivity = onWindowActivity(repaint); // pauses the time-driven repaint, resumes it on return
    return () => {
      offActivity();
      disposed = true;
      clearTimeout(tick);
      clearTimeout(minute);
      motion.removeEventListener("change", repaint);
      repaintRef.current = () => {};
      inputRef.current?.dispose();
      inputRef.current = null;
    };
  }, [canvasRef, makeInput, latest]);

  useEffect(() => repaintRef.current(), [model, state]);

  return { frameRef, makeInput };
}
