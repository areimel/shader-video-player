import { useEffect, type RefObject } from "react";
import { useLatest } from "./useLatest";

export type DismissReason = "escape" | "outside";

interface Options {
  enabled?: boolean;
  /** Also dismiss on pointerdown outside `ref`. Default true. */
  outside?: boolean;
}

interface Entry { dismiss: (reason: DismissReason) => void }

/** Open dismissables, oldest first. Escape only ever closes the last one (the topmost). */
const stack: Entry[] = [];

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== "Escape") return;
  const top = stack[stack.length - 1];
  if (!top) return;
  e.preventDefault();
  e.stopPropagation(); // capture phase: keeps fullscreen/other Escape handlers from also firing
  top.dismiss("escape");
}

function register(entry: Entry): () => void {
  if (stack.length === 0) window.addEventListener("keydown", onKeyDown, true);
  stack.push(entry);
  return () => {
    stack.splice(stack.indexOf(entry), 1);
    if (stack.length === 0) window.removeEventListener("keydown", onKeyDown, true);
  };
}

/** Closes a popover/panel on Escape (topmost only) and, optionally, on a pointerdown outside `ref`. */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  onDismiss: (reason: DismissReason) => void,
  { enabled = true, outside = true }: Options = {},
) {
  const cb = useLatest(onDismiss);

  useEffect(() => {
    if (!enabled) return;
    const entry: Entry = { dismiss: (r) => cb.current(r) };
    const unregister = register(entry);
    const onPointer = (e: PointerEvent) => {
      if (outside && !ref.current?.contains(e.target as Node)) entry.dismiss("outside");
    };
    window.addEventListener("pointerdown", onPointer);
    return () => { unregister(); window.removeEventListener("pointerdown", onPointer); };
  }, [enabled, outside, ref]);
}
