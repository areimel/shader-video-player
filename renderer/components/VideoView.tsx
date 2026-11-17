import type { RefObject } from "react";
import type { PlaybackPlan } from "../types/player";
import type { SubSize } from "../utils/subtitleTiming";
import { SubtitleOverlay } from "./SubtitleOverlay";

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  plan: PlaybackPlan;
  initialTime: number;
  subtitleUrl: string | null;
  controlsVisible: boolean;
  subtitleDelay: number;
  subtitleSize: SubSize;
  /** True while a shader effect draws the picture: the video stays decoding but is not shown. */
  hidden?: boolean;
  onToggle: () => void;
  onFullscreen: () => void;
  /** `detail` is Chromium's MediaError message, when there is one. */
  onError: (absTime: number, detail?: string) => void;
}

export function VideoView({ videoRef, plan, initialTime, subtitleUrl, controlsVisible, subtitleDelay, subtitleSize, hidden = false, onToggle, onFullscreen, onError }: Props) {
  // crossOrigin makes the video (and its <track> subtitles) CORS-mode requests, required for WebGL to sample it.
  // The track has no `default`: SubtitleOverlay switches it to "hidden" and paints the cues itself.
  return (
    <>
      <video
        key={plan.url} ref={videoRef} src={plan.url} className={hidden ? "video video-hidden" : "video"} autoPlay
        crossOrigin="anonymous"
        onClick={onToggle} onDoubleClick={onFullscreen}
        onLoadedMetadata={(e) => { if (initialTime > 0) e.currentTarget.currentTime = initialTime; }}
        onError={(e) => onError(plan.startOffset + e.currentTarget.currentTime, e.currentTarget.error?.message)}
      >
        {subtitleUrl && <track key={subtitleUrl} kind="subtitles" src={subtitleUrl} />}
      </video>
      <SubtitleOverlay videoRef={videoRef} trackKey={subtitleUrl} videoKey={plan.url} controlsVisible={controlsVisible} delay={subtitleDelay} size={subtitleSize} />
    </>
  );
}
