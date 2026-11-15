import { IconButton } from "./common/IconButton";
import { Dropdown } from "./common/Dropdown";
import type { SubtitleState } from "../hooks/useSubtitles";
import { QueuePanel } from "./QueuePanel";
import type { PlayQueue } from "../hooks/usePlayQueue";
import { SeekBar } from "./SeekBar";
import { TrackMenus } from "./TrackMenus";
import { VolumeControl } from "./VolumeControl";
import type { PlayerState } from "../hooks/usePlayerState";
import { SPEEDS } from "../hooks/usePlayerState";
import type { PlaybackPlan } from "../types/player";
import { formatTime } from "../utils/format";

interface Props {
  plan: PlaybackPlan;
  player: PlayerState;
  visible: boolean;
  fullscreen: boolean;
  subs: SubtitleState;
  onAudio: (ordinal: number) => void;
  onFullscreen: () => void;
  onPip: () => void;
  onInfo: () => void;
  effectsActive: boolean;
  onEffects: () => void;
  queue: PlayQueue;
}

export function Controls({ plan, player: p, visible, fullscreen, subs, onAudio, onFullscreen, onPip, onInfo, effectsActive, onEffects, queue }: Props) {
  return (
    <div className={`controls ${visible ? "" : "is-hidden"}`} onDoubleClick={(e) => e.stopPropagation()}>
      <SeekBar time={p.time} duration={p.duration} buffered={p.bufferedEnd} onSeek={p.seek} />
      <div className="controls-row">
        <div className="controls-group">
          <IconButton icon={p.paused ? "play" : "pause"} label={p.paused ? "Play (Space)" : "Pause (Space)"} onClick={p.toggle} />
          {queue.multi && <IconButton icon="skipPrev" label="Previous (P)" onClick={queue.previous} />}
          {queue.multi && <IconButton icon="skipNext" label="Next (N)" onClick={queue.next} />}
          <IconButton icon="back10" label="Back 10 seconds" onClick={() => p.seek(p.time - 10)} />
          <IconButton icon="fwd10" label="Forward 10 seconds" onClick={() => p.seek(p.time + 10)} />
          <VolumeControl volume={p.volume} muted={p.muted} onVolume={p.setVolume} onToggleMute={p.toggleMute} />
          <span className="time">{formatTime(p.time)} / {formatTime(p.duration)}</span>
        </div>
        <div className="controls-group">
          {queue.multi && <QueuePanel queue={queue} />}
          <TrackMenus plan={plan} subs={subs} onAudio={onAudio} />
          <Dropdown
            icon="speed" label="Speed ([ and ])" selected={p.rate} onSelect={p.setRate}
            buttonText={`${p.rate}×`} options={SPEEDS.map((s) => ({ value: s, label: `${s}×` }))}
          />
          <IconButton icon="effects" label="Effects (E toggle, Shift+E panel)" active={effectsActive} onClick={onEffects} />
          <IconButton icon="info" label="File info" onClick={onInfo} />
          <IconButton icon="pip" label="Picture in picture" onClick={onPip} />
          <IconButton icon={fullscreen ? "exitFullscreen" : "fullscreen"} label="Fullscreen (F)" onClick={onFullscreen} />
        </div>
      </div>
    </div>
  );
}
