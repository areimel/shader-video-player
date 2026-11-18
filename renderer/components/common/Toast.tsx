import { useCallback, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";
import type { ToastAction, ToastItem, ToastKind } from "../../types/player";

export function useToasts() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback((kind: ToastKind, message: string, action?: ToastAction) => {
    const id = nextId.current++;
    setItems((l) => [...l.slice(-3), { id, kind, message, ...(action && { action }) }]);
    // A toast with a button stays longer so there is time to reach it.
    setTimeout(() => dismiss(id), action ? 10000 : 4000);
  }, [dismiss]);
  return { items, push, dismiss };
}

/** The bottom-right stack. `children` (the job cards) sit above the toasts, in the same column. */
export function ToastHost({ items, onDismiss, children }: { items: ToastItem[]; onDismiss?: (id: number) => void; children?: ReactNode }) {
  return (
    <div className="toast-host">
      {children}
      <div className="toast-list" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <span>{t.message}</span>
          {t.action && (
            <Button variant="quiet" className="toast-action" onClick={() => { t.action!.run(); onDismiss?.(t.id); }}>
              {t.action.label}
            </Button>
          )}
        </div>
      ))}
      </div>
    </div>
  );
}
