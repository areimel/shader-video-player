import { useEffect } from "react";
import { useLatest } from "./useLatest";
import { COMMANDS, isCommandId, type CommandId } from "../../shared/commands";

export type CommandHandlers = Partial<Record<CommandId, () => void>>;

interface Binding { id: CommandId; shift: boolean; key: string }

function parse(key: string): Binding | null {
  const shift = key.startsWith("Shift+") && key.length > 6;
  const k = shift ? key.slice(6) : key;
  return k ? { id: "" as CommandId, shift, key: k.length === 1 ? k.toLowerCase() : k } : null;
}

// key (lowercased for single chars) -> bindings, built once from the command table.
const BINDINGS = new Map<string, Binding[]>();
for (const c of COMMANDS) {
  for (const k of ("keys" in c ? c.keys : []) as readonly string[]) {
    const b = parse(k);
    if (!b) continue;
    b.id = c.id;
    BINDINGS.set(b.key, [...(BINDINGS.get(b.key) ?? []), b]);
  }
}

/** Resolves a keydown to a command id, or undefined. Exported for tests/overlay reuse. */
export function commandForKey(e: Pick<KeyboardEvent, "key" | "shiftKey">): CommandId | undefined {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const list = BINDINGS.get(k);
  if (!list) return undefined;
  // "?" (and other shifted symbols) match regardless of the shift flag.
  const symbol = k.length === 1 && k.toLowerCase() === k.toUpperCase();
  return list.find((b) => symbol || b.shift === e.shiftKey)?.id;
}

/**
 * Generic keyboard dispatcher. The caller decides which handlers exist (e.g. omit media commands when
 * nothing is open, but keep `shortcuts`). Commands without a handler are no-ops and the key is left
 * alone. `enabled` lets the caller suspend all shortcuts (e.g. while a modal owns the keyboard).
 */
export function usePlayerShortcuts(enabled: boolean, handlers: CommandHandlers): void {
  const ref = useLatest(handlers);
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
      // Space/Enter on a focused control activates that control, not a global command.
      if ((e.key === " " || e.key === "Enter") && t?.closest('button, a[href], [role="radio"], [role="switch"], [role="option"], [role="slider"]')) return;
      const id = commandForKey(e);
      const h = id && ref.current[id];
      if (!h) return;
      e.preventDefault();
      h();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}

/** Runs handlers for commands sent from the native menu. Unknown ids are ignored. */
export function useMenuCommands(handlers: CommandHandlers): void {
  const ref = useLatest(handlers);
  useEffect(() => window.player.onCommand((id) => {
    if (isCommandId(id)) ref.current[id]?.();
  }), []);
}
