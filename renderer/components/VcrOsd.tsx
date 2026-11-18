import type { OsdState } from "../utils/osd";
import { formatCounter, statusText, volumeNumber, volumeSegments } from "../utils/osd";
import { Icon } from "./common/Icon";

interface Props {
  state: OsdState;
  /** Current media time for the tape counter. */
  time: number;
  /** Top bar / control bar are showing, so the slots move clear of them. */
  chromeVisible: boolean;
}

const SEGMENTS = 16;

/** Transient VCR on-screen display inside the title-safe margin. Decorative: aria-hidden. */
export function VcrOsd({ state, time, chromeVisible }: Props) {
  const { status, level } = state;
  if (!status && !level) return null;
  const text = status ? statusText(status.event) : null;
  const vol = level?.event.kind === "volume" ? level.event : null;
  const filled = vol && !vol.muted ? volumeSegments(vol.level, SEGMENTS) : 0;
  return (
    <div className={`osd ${chromeVisible ? "osd-chrome" : ""}`} aria-hidden="true">
      {text && (
        <>
          <div className="osd-status vcr-text vcr-text-md">
            {text.glyph && <Icon name={text.glyph} size={20} />}
            <span>{text.label}</span>
          </div>
          <div className="osd-counter vcr-text vcr-text-md">{formatCounter(time)}</div>
        </>
      )}
      {vol && (
        <div className="osd-level vcr-text vcr-text-md">
          {vol.muted ? <span className="vcr-inverted osd-mute">MUTE</span> : (
            <>
              <span>VOLUME</span>
              <span className="osd-bar vcr-box">
                {Array.from({ length: SEGMENTS }, (_, i) => <i key={i} className={i < filled ? "on" : ""} />)}
              </span>
              <span className="osd-num">{volumeNumber(vol.level)}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
