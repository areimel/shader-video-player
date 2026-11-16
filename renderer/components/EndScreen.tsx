import { useEffect, useRef } from "react";
import { Icon } from "./common/Icon";

interface Props {
  /** Offer to start the whole queue again. */
  multi: boolean;
  onReplay: () => void;
  onPlayQueue: () => void;
  onHome: () => void;
}

/** Shown over the last frame when playback finished and nothing else will play. */
export function EndScreen({ multi, onReplay, onPlayQueue, onHome }: Props) {
  const replay = useRef<HTMLButtonElement>(null);
  useEffect(() => replay.current?.focus(), []);
  return (
    <div className="end-screen" role="dialog" aria-label="Playback finished" onDoubleClick={(e) => e.stopPropagation()}>
      <div className="end-actions">
        <button type="button" ref={replay} className="primary-btn end-btn" onClick={onReplay}>
          <Icon name="replay" size={18} /> Replay
        </button>
        {multi && <button type="button" className="primary-btn end-btn" onClick={onPlayQueue}>Play queue again</button>}
        <button type="button" className="link-btn" onClick={onHome}>Back to home</button>
      </div>
    </div>
  );
}
