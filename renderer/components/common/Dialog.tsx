import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { useDismiss } from "../../hooks/useDismiss";

interface Props {
  title: string;
  children: ReactNode;
  /** The button row (right-aligned). */
  actions: ReactNode;
  onDismiss: () => void;
  /** An action is running: Escape and outside clicks no longer close the dialog. */
  busy?: boolean;
  /** CSS width of the box (default 460px). */
  width?: string;
}

/**
 * Small centred modal in the VCR menu look: title on a dashed rule, body, button row.
 * Focus moves into the dialog (to the first field, else the box); Escape and an outside click dismiss it
 * unless `busy`. Keys typed inside never reach the single-key player shortcuts.
 */
export function Dialog({ title, children, actions, onDismiss, busy = false, width }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, onDismiss, { enabled: !busy, outside: true });
  useEffect(() => {
    const first = ref.current?.querySelector<HTMLElement>("input, select, textarea");
    (first ?? ref.current)?.focus();
  }, []);
  // Single-key shortcuts listen on window; Escape stays free for useDismiss (capture phase).
  const stopKeys = (e: KeyboardEvent) => { if (e.key !== "Escape") e.stopPropagation(); };
  return (
    <div className="backdrop" onKeyDown={stopKeys}>
      <div ref={ref} className="dialog vcr-panel" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        style={width ? { width: `min(${width}, 100%)` } : undefined}>
        <div className="dialog-title vcr-rule vcr-text">{title}</div>
        <div className="dialog-body">{children}</div>
        <div className="dialog-actions">{actions}</div>
      </div>
    </div>
  );
}
