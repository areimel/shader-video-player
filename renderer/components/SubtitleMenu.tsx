import { useRef, useState } from "react";
import type { PlaybackPlan } from "../types/player";
import { SUB_OFF, embeddedChoice, externalChoice, type SubtitleState } from "../hooks/useSubtitles";
import { useDismiss } from "../hooks/useDismiss";
import { SUB_DELAY_STEP, SUB_SIZES, formatDelay } from "../utils/subtitleTiming";
import { trackLabel } from "../utils/format";
import { Button } from "./common/Button";
import { IconButton } from "./common/IconButton";
import { Panel } from "./common/Panel";
import { Segmented } from "./common/Segmented";

const SIZE_OPTIONS = SUB_SIZES.map((s) => ({ value: s.id, label: s.label }));

/** Controls-bar popover: track list, text size and timing delay. */
export function SubtitleMenu({ plan, subs }: { plan: PlaybackPlan; subs: SubtitleState }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, () => setOpen(false), { enabled: open });

  const rows = [
    { value: SUB_OFF, label: "Off" },
    ...plan.info.subtitleTracks.map((t) => ({ value: embeddedChoice(t.ordinal), label: trackLabel(t, t.ordinal + 1) })),
    ...subs.external.map((s) => ({ value: externalChoice(s.id), label: s.name })),
  ];

  return (
    <div className="dropdown" ref={ref}>
      <IconButton icon="subtitles" label="Subtitles" active={open || subs.choice !== SUB_OFF} aria-expanded={open}
        aria-haspopup="dialog" onClick={() => setOpen(!open)} />
      {open && (
        <Panel className="sub-menu" role="dialog" aria-label="Subtitles">
          <div className="sub-tracks" role="group" aria-label="Subtitle track">
            {rows.map((r) => (
              <button key={r.value} type="button" aria-pressed={r.value === subs.choice}
                className={`list-row ${r.value === subs.choice ? "is-selected is-current" : ""}`}
                onClick={() => subs.setChoice(r.value)}>{r.label}</button>
            ))}
            <button type="button" className="list-row" onClick={() => { setOpen(false); void subs.pickFile(); }}>
              Load subtitle file…
            </button>
          </div>
          <div className="sub-setting">
            <span className="sub-label">Size</span>
            <Segmented options={SIZE_OPTIONS} value={subs.size} label="Subtitle size" onChange={subs.setSize} />
          </div>
          <div className="sub-setting">
            <span className="sub-label">Delay</span>
            <div className="sub-delay">
              <button type="button" className="icon-btn" aria-label={`Subtitles ${SUB_DELAY_STEP} s earlier`}
                onClick={() => subs.stepDelay(-1)}>−</button>
              <output className="sub-delay-value" aria-live="polite">{formatDelay(subs.delay)}</output>
              <button type="button" className="icon-btn" aria-label={`Subtitles ${SUB_DELAY_STEP} s later`}
                onClick={() => subs.stepDelay(1)}>+</button>
              {subs.delay !== 0 && <Button variant="link" onClick={subs.resetDelay}>Reset</Button>}
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
