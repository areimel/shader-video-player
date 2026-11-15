import { useEffect, useRef, useState } from "react";
import type { PlayQueue } from "../hooks/usePlayQueue";
import { IconButton } from "./common/IconButton";

/** Controls-bar button that opens a popover listing the queue; click a row to jump, x to remove. */
export function QueuePanel({ queue }: { queue: PlayQueue }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="dropdown" ref={ref}>
      <IconButton icon="queue" label="Play queue" active={open} aria-expanded={open} onClick={() => setOpen(!open)} />
      {open && (
        <div className="dropdown-menu queue-panel">
          <div className="queue-head">
            <strong>Queue ({queue.index + 1}/{queue.items.length})</strong>
            <button type="button" className="link-btn" onClick={() => { queue.clear(); setOpen(false); }}>Clear</button>
          </div>
          <ul className="queue-list">
            {queue.items.map((it, i) => (
              <li key={`${i}:${it.path}`} className={`queue-row ${i === queue.index ? "is-current" : ""}`}>
                <button type="button" className="queue-item" title={it.path} onClick={() => queue.jumpTo(i)}>
                  <span className="queue-num">{i === queue.index ? "▶" : i + 1}</span>
                  <span className="queue-name">{it.name}</span>
                </button>
                {i !== queue.index && (
                  <button type="button" className="queue-remove" aria-label={`Remove ${it.name}`}
                    title="Remove from queue" onClick={() => queue.remove(i)}>×</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
