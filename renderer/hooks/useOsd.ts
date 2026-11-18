import { useCallback, useEffect, useMemo, useReducer } from "react";
import { OSD_INITIAL, nextExpiry, osdReducer, type OsdEvent, type OsdState } from "../utils/osd";
import { nextLoopMode } from "../utils/queue";
import type { PlayerState } from "./usePlayerState";
import { SPEEDS } from "./usePlayerState";
import type { PlayQueue } from "./usePlayQueue";

export type ShowOsd = (event: OsdEvent) => void;

/** Transient on-screen display state: one timeout is armed for the earliest slot expiry. */
export function useOsd(): { state: OsdState; show: ShowOsd } {
  const [state, dispatch] = useReducer(osdReducer, OSD_INITIAL);
  const show = useCallback<ShowOsd>((event) => dispatch({ type: "show", event, now: Date.now() }), []);
  const expiry = nextExpiry(state);
  useEffect(() => {
    if (expiry === null) return;
    // A timer may fire a hair early; expiring at `expiry` at least means the slot always clears
    // (an unchanged state would never re-arm this effect).
    const t = setTimeout(() => dispatch({ type: "expire", now: Math.max(Date.now(), expiry) }), Math.max(0, expiry - Date.now()));
    return () => clearTimeout(t);
  }, [expiry]);
  return { state, show };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** The rate stepRate will land on (mirrors usePlayerState.stepRate). */
export function steppedRate(rate: number, dir: 1 | -1): number {
  const i = SPEEDS.findIndex((s) => s >= rate - 1e-6);
  return SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, (i < 0 ? SPEEDS.length - 1 : i) + dir))];
}

/**
 * Wraps the player and queue handed to Controls so clicks show the OSD like the shortcuts do.
 * The back/forward buttons go through the seekBack/seekForward commands instead (Controls' onSeekStep).
 */
export function useOsdControls(player: PlayerState, queue: PlayQueue, show: ShowOsd): { player: PlayerState; queue: PlayQueue } {
  return useMemo(() => {
    const p: PlayerState = {
      ...player,
      toggle: () => { player.toggle(); show({ kind: "transport", op: player.paused ? "play" : "pause" }); },
      setVolume: (n) => { player.setVolume(n); show({ kind: "volume", level: clamp01(n), muted: false }); },
      toggleMute: () => { player.toggleMute(); show({ kind: "volume", level: player.volume, muted: !player.muted }); },
      setRate: (n) => { player.setRate(n); show({ kind: "speed", rate: n }); },
    };
    const q: PlayQueue = {
      ...queue,
      cycleLoop: () => { queue.cycleLoop(); show({ kind: "loop", mode: nextLoopMode(queue.loop) }); },
      next: () => { queue.next(); show({ kind: "transport", op: "next" }); },
      previous: () => { queue.previous(); show({ kind: "transport", op: "prev" }); },
    };
    return { player: p, queue: q };
  }, [player, queue, show]);
}
