import { useRef, useState } from "react";
import type { PlayQueue } from "../hooks/usePlayQueue";
import { useDismiss } from "../hooks/useDismiss";
import { Button } from "./common/Button";
import { IconButton } from "./common/IconButton";
import { Panel, PanelHeader } from "./common/Panel";

/** Controls-bar button that opens a popover listing the queue; click a row to jump, x to remove. */
export function QueuePanel({ queue }: { queue: PlayQueue }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, () => setOpen(false), { enabled: open });

  return (
    <div className="dropdown" ref={ref}>
      <IconButton icon="queue" label="Play queue" active={open} aria-expanded={open} onClick={() => setOpen(!open)} />
      {open && (
        <Panel className="queue-panel" aria-label="Play queue">
          <PanelHeader title={`Queue (${queue.index + 1}/${queue.items.length})`}>
            <Button variant="link" onClick={() => { queue.clear(); setOpen(false); }}>Clear</Button>
          </PanelHeader>
          <ul className="queue-list">
            {queue.items.map((it, i) => (
              <li key={`${i}:${it.path}`} className={`list-row queue-row ${i === queue.index ? "is-current" : ""}`}>
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
        </Panel>
      )}
    </div>
  );
}
