import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { parseCueText } from "../utils/cueText";

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Changes when the <track> element is replaced. */
  trackKey: string | null;
  /** Changes when the <video> element is remounted (new source). */
  videoKey: string;
  controlsVisible: boolean;
}

function activeTexts(track: TextTrack): string[] {
  const out: string[] = [];
  for (const cue of Array.from(track.activeCues ?? [])) {
    if ("text" in cue && typeof cue.text === "string") out.push(cue.text);
  }
  return out;
}

function renderCue(text: string): ReactNode {
  return parseCueText(text).map((line, i) => (
    <div key={i} className="subtitle-line">
      {line.map((s, j) => {
        let node: ReactNode = s.text;
        if (s.bold) node = <b>{node}</b>;
        if (s.italic) node = <i>{node}</i>;
        return <span key={j}>{node}</span>;
      })}
    </div>
  ));
}

/**
 * Draws the active cues above the picture (plain video or shader canvas). The <track> stays on the
 * video in "hidden" mode so the browser parses cues but never paints them.
 */
export function SubtitleOverlay({ videoRef, trackKey, videoKey, controlsVisible }: Props) {
  const [cues, setCues] = useState<string[]>([]);

  useEffect(() => {
    const el = videoRef.current?.querySelector("track");
    const track = el?.track;
    if (!el || !track) { setCues([]); return; }
    track.mode = "hidden";
    const update = () => {
      track.mode = "hidden"; // the browser may re-enable a track when it finishes loading
      setCues(activeTexts(track));
    };
    track.addEventListener("cuechange", update);
    el.addEventListener("load", update);
    update();
    return () => {
      track.removeEventListener("cuechange", update);
      el.removeEventListener("load", update);
      setCues([]);
    };
  }, [videoRef, trackKey, videoKey]);

  if (cues.length === 0) return null;
  return (
    <div className={`subtitle-overlay ${controlsVisible ? "controls-up" : ""}`} aria-hidden="true">
      <div className="subtitle-box">
        {cues.map((c, i) => <div key={i} className="subtitle-cue">{renderCue(c)}</div>)}
      </div>
    </div>
  );
}
