import type { OsdEvent, OsdState } from "../utils/osd";
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

/**
 * Transient VCR on-screen display inside the title-safe margin. The picture is aria-hidden; a visually
 * hidden live region announces the same messages (shortcut changes would otherwise be silent).
 */
export function VcrOsd({ state, time, chromeVisible }: Props) {
  const { status, level } = state;
  const text = status ? statusText(status.event) : null;
  const vol = level?.event.kind === "volume" ? level.event : null;
  const filled = vol && !vol.muted ? volumeSegments(vol.level, SEGMENTS) : 0;
  const spoken = [text?.label, vol && (vol.muted ? "MUTE" : `VOLUME ${volumeNumber(vol.level)}`)].filter(Boolean).join(", ");
  return (
    <>
      <div className="visually-hidden" role="status" aria-live="polite">{spoken}</div>
      {(text || vol) && <OsdPicture text={text} vol={vol} filled={filled} time={time} chromeVisible={chromeVisible} />}
    </>
  );
}

interface PictureProps {
  text: ReturnType<typeof statusText> | null;
  vol: Extract<OsdEvent, { kind: "volume" }> | null;
  filled: number;
  time: number;
  chromeVisible: boolean;
}

function OsdPicture({ text, vol, filled, time, chromeVisible }: PictureProps) {
  return (
    <div className={`osd ${chromeVisible ? "osd-chrome" : ""}`} aria-hidden="true">
      {text && (
        <>
          <div className="osd-status vcr-text vcr-text-md">
            {text.glyph && <Icon name={text.glyph} size={24} />}
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
