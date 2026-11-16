/** True on macOS; selects the ⌘/⌥ key labels used by `hint()` / `formatKey()`. */
export const IS_MAC = typeof window !== "undefined" && window.player?.platform === "darwin";
