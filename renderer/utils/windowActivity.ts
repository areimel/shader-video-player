/** The window is on screen and has focus: the only time the home screen animates or the canvas input "plays". */
export const windowActive = (): boolean => document.visibilityState === "visible" && document.hasFocus();

/** Calls `onChange` whenever `windowActive()` may have flipped; returns the unsubscribe. */
export function onWindowActivity(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  window.addEventListener("focus", onChange);
  window.addEventListener("blur", onChange);
  return () => {
    document.removeEventListener("visibilitychange", onChange);
    window.removeEventListener("focus", onChange);
    window.removeEventListener("blur", onChange);
  };
}
