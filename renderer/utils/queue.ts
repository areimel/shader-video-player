import type { QueueItem } from "../types/player";

export interface QueueState {
  items: QueueItem[];
  index: number;
}

export type QueueAction =
  | { type: "replace"; items: QueueItem[]; index?: number }
  | { type: "next" }
  | { type: "previous" }
  | { type: "jumpTo"; index: number }
  | { type: "remove"; index: number }
  | { type: "clear" };

export const EMPTY_QUEUE: QueueState = { items: [], index: 0 };

/** `previous` restarts the current item when more than this many seconds in. */
export const RESTART_THRESHOLD_SEC = 3;

const inRange = (s: QueueState, i: number) => Number.isInteger(i) && i >= 0 && i < s.items.length;

export function nextIndex(s: QueueState): number | null {
  return s.index + 1 < s.items.length ? s.index + 1 : null;
}

/** Index to play for "previous"; equal to `s.index` means restart the current item. */
export function previousTarget(s: QueueState, timeSec: number): number {
  return timeSec > RESTART_THRESHOLD_SEC || s.index <= 0 ? s.index : s.index - 1;
}

/** Removing the current item is a no-op (it is the one playing); earlier items shift the index. */
export function queueReducer(s: QueueState, a: QueueAction): QueueState {
  switch (a.type) {
    case "replace":
      return { items: a.items, index: a.items.length ? Math.min(Math.max(a.index ?? 0, 0), a.items.length - 1) : 0 };
    case "next": {
      const n = nextIndex(s);
      return n === null ? s : { ...s, index: n };
    }
    case "previous":
      return s.index > 0 ? { ...s, index: s.index - 1 } : s;
    case "jumpTo":
      return inRange(s, a.index) ? { ...s, index: a.index } : s;
    case "remove": {
      if (!inRange(s, a.index) || a.index === s.index) return s;
      const items = s.items.filter((_, i) => i !== a.index);
      return { items, index: a.index < s.index ? s.index - 1 : s.index };
    }
    case "clear":
      return EMPTY_QUEUE;
  }
}
