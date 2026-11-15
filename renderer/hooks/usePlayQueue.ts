import { useCallback, useEffect, useMemo, useReducer, useRef, type RefObject } from "react";
import type { QueueItem, ToastKind } from "../types/player";
import { EMPTY_QUEUE, nextIndex, previousTarget, queueReducer } from "../utils/queue";
import { usePlaybackSource } from "./usePlaybackSource";

/** Owns the play queue and the playback source it drives; every item plays via the single-file open path. */
export function usePlayQueue(
  videoRef: RefObject<HTMLVideoElement | null>,
  notify: (kind: ToastKind, msg: string) => void,
) {
  const [state, dispatch] = useReducer(queueReducer, EMPTY_QUEUE);
  const stateRef = useRef(state);
  stateRef.current = state;

  const replace = useCallback((items: QueueItem[]) => dispatch({ type: "replace", items }), []);
  const source = usePlaybackSource(notify, replace);
  const { plan, openQueued, restartAt } = source;

  /** Opens item `i`; the highlight moves only once it plays. `auto` skips unplayable items. */
  const goTo = useCallback(async (i: number, auto = false): Promise<void> => {
    const { items } = stateRef.current;
    if (!items[i]) return;
    const ok = await openQueued(items[i].path);
    if (stateRef.current.items !== items) return; // the queue was replaced meanwhile
    if (ok) dispatch({ type: "jumpTo", index: i });
    else if (auto) await goTo(i + 1, true);
  }, [openQueued]);

  const next = useCallback(() => {
    const n = nextIndex(stateRef.current);
    if (n !== null) void goTo(n);
  }, [goTo]);

  const previous = useCallback(() => {
    const v = videoRef.current;
    const t = (plan?.startOffset ?? 0) + (v?.currentTime ?? 0);
    const target = previousTarget(stateRef.current, t);
    if (target !== stateRef.current.index) { void goTo(target); return; }
    if (!plan || !v) return;
    if (plan.mode === "native" || plan.startOffset === 0) v.currentTime = 0;
    else void restartAt(0, plan.audioOrdinal);
  }, [videoRef, plan, goTo, restartAt]);

  // Auto-advance; at the end of the queue the video simply stays ended.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !plan) return;
    const onEnded = () => {
      const n = nextIndex(stateRef.current);
      if (n !== null) void goTo(n, true);
    };
    v.addEventListener("ended", onEnded);
    return () => v.removeEventListener("ended", onEnded);
  }, [videoRef, plan, goTo]);

  const queue = useMemo(() => ({
    items: state.items,
    index: state.index,
    /** Navigation only makes sense (and is shown) with more than one item. */
    multi: state.items.length > 1,
    next, previous,
    jumpTo: (i: number) => void goTo(i),
    remove: (i: number) => dispatch({ type: "remove", index: i }),
    clear: () => dispatch({ type: "clear" }),
  }), [state, next, previous, goTo]);

  return { ...source, queue };
}

export type PlayQueue = ReturnType<typeof usePlayQueue>["queue"];
