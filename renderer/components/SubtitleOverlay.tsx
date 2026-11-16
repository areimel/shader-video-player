import { useEffect, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { parseCueText } from "../utils/cueText";
import { SUB_SIZES, activeCues, untilNextChange, type SubSize, type TimedCue } from "../utils/subtitleTiming";

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Changes when the <track> element is replaced. */
  trackKey: string | null;
  /** Changes when the <video> element is remounted (new source). */
  videoKey: string;
  controlsVisible: boolean;
  /** Seconds to shift the cues later (negative = earlier). */
  delay?: number;
  size?: SubSize;
}

interface TextCue extends TimedCue { text: string }

function textCues(track: TextTrack): TextCue[] {
  const out: TextCue[] = [];
  for (const c of Array.from(track.cues ?? [])) {
    if ("text" in c && typeof c.text === "string") out.push({ start: c.startTime, end: c.endTime, text: c.text });
  }
  return out;
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

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
 *
 * Cue times already exclude the stream's startOffset, so video.currentTime is compared directly. We
 * compute the active set ourselves (needed for the user delay) and, instead of polling, sleep until
 * the next cue boundary (scaled by playbackRate); play/pause/seek/rate/delay changes reschedule.
 * That is exact to timer precision and costs nothing between boundaries.
 */
export function SubtitleOverlay({ videoRef, trackKey, videoKey, controlsVisible, delay = 0, size = "m" }: Props) {
  const [cues, setCues] = useState<string[]>([]);

  useEffect(() => {
    const video = videoRef.current;
    const el = video?.querySelector("track");
    const track = el?.track;
    if (!video || !el || !track) { setCues([]); return; }
    track.mode = "hidden";
    let all: TextCue[] = [];
    let timer = 0;

    const update = () => {
      window.clearTimeout(timer);
      track.mode = "hidden"; // the browser may re-enable a track when it finishes loading
      all = textCues(track);
      const t = video.currentTime;
      const next = activeCues(all, t, delay).map((c) => c.text);
      setCues((prev) => (same(prev, next) ? prev : next));
      const wait = untilNextChange(all, t, delay);
      if (wait !== null && !video.paused && video.playbackRate > 0) {
        timer = window.setTimeout(update, Math.max(wait / video.playbackRate * 1000, 16));
      }
    };

    const events = ["play", "pause", "seeking", "seeked", "ratechange", "loadedmetadata"] as const;
    events.forEach((e) => video.addEventListener(e, update));
    el.addEventListener("load", update);
    update();
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => video.removeEventListener(e, update));
      el.removeEventListener("load", update);
      setCues([]);
    };
  }, [videoRef, trackKey, videoKey, delay]);

  if (cues.length === 0) return null;
  const scale = SUB_SIZES.find((s) => s.id === size)?.scale ?? 1;
  return (
    <div className={`subtitle-overlay ${controlsVisible ? "controls-up" : ""}`} style={{ "--sub-scale": scale } as CSSProperties} aria-hidden="true">
      <div className="subtitle-box">
        {cues.map((c, i) => <div key={i} className="subtitle-cue">{renderCue(c)}</div>)}
      </div>
    </div>
  );
}
