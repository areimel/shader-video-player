import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type RefObject } from "react";
import type { QueueItem, ToastKind } from "../types/player";
import { friendlyError } from "../utils/format";
import {
  EMPTY_QUEUE, autoAdvanceTarget, manualNext, nextLoopMode, previousTarget, queueReducer, reachedEnd,
} from "../utils/queue";
import { loadLoop, saveLoop } from "../utils/storage";
import { single, usePlaybackSource } from "./usePlaybackSource";

/** Owns the play queue and the playback source it drives; every item plays via the single-file open path. */
export function usePlayQueue(
  videoRef: RefObject<HTMLVideoElement | null>,
  notify: (kind: ToastKind, msg: string) => void,
) {
  const [state, dispatch] = useReducer(queueReducer, EMPTY_QUEUE);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [loop, setLoop] = useState(loadLoop);
  const loopRef = useRef(loop);
  loopRef.current = loop;
  /** True once the media really ended with nothing left to play; drives the end screen. */
  const [ended, setEnded] = useState(false);

  const replace = useCallback((items: QueueItem[], index = 0) => dispatch({ type: "replace", items, index }), []);
  const source = usePlaybackSource(notify, replace);
  const { plan, loading, openQueued, restartAt, openDialog, openDropped, close: closeSource } = source;
  const loadingRef = useRef(false);
  loadingRef.current = loading;

  /** The path being opened; navigation is ignored meanwhile so "next" twice cannot chase the same item. */
  const pending = useRef<string | null>(null);

  /** Opens item `i`; the highlight moves only once it plays. `auto` skips unplayable items. */
  const goTo = useCallback(async (i: number, auto = false): Promise<void> => {
    const target = stateRef.current.items[i];
    if (!target || pending.current) return;
    pending.current = target.path;
    let ok: boolean;
    try { ok = await openQueued(target.path); } finally { pending.current = null; }
    // The queue may have changed meanwhile (remove/replace): find the target by path, not by old index.
    const at = stateRef.current.items.findIndex((it) => it.path === target.path);
    if (at < 0) return;
    if (ok) dispatch({ type: "jumpTo", index: at });
    else if (auto) await goTo(at + 1, true);
  }, [openQueued]);

  /** Plays the current item again from the start (also used from the ended state). */
  const restartCurrent = useCallback(() => {
    const v = videoRef.current;
    if (!plan || !v) return;
    setEnded(false);
    // A finished transcode may no longer hold the start, so it restarts the stream instead of seeking.
    if (plan.mode === "native") {
      v.currentTime = 0;
      void v.play().catch(() => undefined);
    } else void restartAt(0, plan.audioOrdinal);
  }, [videoRef, plan, restartAt]);

  const next = useCallback(() => {
    const n = manualNext(stateRef.current, loopRef.current);
    if (n !== null) void goTo(n);
  }, [goTo]);

  const previous = useCallback(() => {
    const v = videoRef.current;
    const t = (plan?.startOffset ?? 0) + (v?.currentTime ?? 0);
    const target = previousTarget(stateRef.current, t);
    if (target !== stateRef.current.index) void goTo(target);
    else restartCurrent();
  }, [videoRef, plan, goTo, restartCurrent]);

  // End of media: loop/advance per the loop mode, otherwise stay on the last frame and show the end screen.
  useEffect(() => {
    setEnded(false);
    const v = videoRef.current;
    if (!v || !plan) return;
    const onEnded = () => {
      // A restart/seek on a transcode disposes the old stream, which ends the old <video> cleanly.
      if (loadingRef.current || !reachedEnd(plan.startOffset, v.currentTime, plan.info.durationSec)) return;
      const s = stateRef.current;
      const n = s.items.length === 0 && loopRef.current !== "off" ? s.index : autoAdvanceTarget(s, loopRef.current);
      if (n === null) setEnded(true);
      else if (n === s.index) restartCurrent();
      else void goTo(n, true);
    };
    const clear = () => setEnded(false);
    v.addEventListener("ended", onEnded);
    v.addEventListener("play", clear);
    v.addEventListener("seeking", clear);
    return () => {
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("play", clear);
      v.removeEventListener("seeking", clear);
    };
  }, [videoRef, plan, goTo, restartCurrent]);

  const cycleLoop = useCallback(() => {
    const m = nextLoopMode(loopRef.current);
    setLoop(m);
    saveLoop(m);
    notify("success", `Loop: ${m}`);
  }, [notify]);

  /** Appends validated items; with no queue but a playing file, that file becomes the first entry. */
  const addItems = useCallback((items: QueueItem[]) => {
    const s = stateRef.current;
    const fresh = items.filter((it) => !s.items.some((q) => q.path === it.path));
    if (!s.items.length && plan) dispatch({ type: "replace", items: single(plan) });
    dispatch({ type: "append", items });
    notify("success", fresh.length ? `Added ${fresh.length} to queue` : "Already in the queue");
  }, [plan, notify]);

  /** Adds via the dialog / a drop; with nothing open the selection simply plays. */
  const addToQueue = useCallback(async () => {
    if (!plan) { void openDialog(); return; }
    try {
      const items = await window.player.addToQueueDialog();
      if (items.length) addItems(items);
    } catch (e) { notify("error", friendlyError(e)); }
  }, [plan, openDialog, addItems, notify]);

  const addDropped = useCallback(async (files: File[]) => {
    if (!plan) { void openDropped(files); return; }
    try {
      const items = await window.player.queueDropped(files);
      if (items.length) addItems(items);
    } catch (e) { notify("error", friendlyError(e)); }
  }, [plan, openDropped, addItems, notify]);

  /** Back to home: drops the playback, empties the queue and clears the end state. */
  const close = useCallback(() => {
    closeSource();
    dispatch({ type: "clear" });
    setEnded(false);
  }, [closeSource]);

  const queue = useMemo(() => ({
    items: state.items,
    index: state.index,
    /** Navigation only makes sense (and is shown) with more than one item. */
    multi: state.items.length > 1,
    loop, cycleLoop, ended,
    next, previous, replay: restartCurrent,
    playFromStart: () => void goTo(0),
    jumpTo: (i: number) => void goTo(i),
    remove: (i: number) => dispatch({ type: "remove", index: i }),
    clear: () => dispatch({ type: "clear" }),
    addToQueue, addDropped,
  }), [state, loop, ended, cycleLoop, next, previous, restartCurrent, goTo, addToQueue, addDropped]);

  return { ...source, close, queue };
}

export type PlayQueue = ReturnType<typeof usePlayQueue>["queue"];
