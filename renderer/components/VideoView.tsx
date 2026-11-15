import type { RefObject } from "react";
import type { PlaybackPlan } from "../types/player";
import { SubtitleOverlay } from "./SubtitleOverlay";

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  plan: PlaybackPlan;
  initialTime: number;
  subtitleUrl: string | null;
  controlsVisible: boolean;
  /** True while a shader effect draws the picture: the video stays decoding but is not shown. */
  hidden?: boolean;
  onToggle: () => void;
  onFullscreen: () => void;
  onError: (absTime: number) => void;
}

export function VideoView({ videoRef, plan, initialTime, subtitleUrl, controlsVisible, hidden = false, onToggle, onFullscreen, onError }: Props) {
  // crossOrigin makes the video (and its <track> subtitles) CORS-mode requests, required for WebGL to sample it.
  // The track has no `default`: SubtitleOverlay switches it to "hidden" and paints the cues itself.
  return (
    <>
      <video
        key={plan.url} ref={videoRef} src={plan.url} className={hidden ? "video video-hidden" : "video"} autoPlay
        crossOrigin="anonymous"
        onClick={onToggle} onDoubleClick={onFullscreen}
        onLoadedMetadata={(e) => { if (initialTime > 0) e.currentTarget.currentTime = initialTime; }}
        onError={(e) => onError(plan.startOffset + e.currentTarget.currentTime)}
      >
        {subtitleUrl && <track key={subtitleUrl} kind="subtitles" src={subtitleUrl} />}
      </video>
      <SubtitleOverlay videoRef={videoRef} trackKey={subtitleUrl} videoKey={plan.url} controlsVisible={controlsVisible} />
    </>
  );
}
