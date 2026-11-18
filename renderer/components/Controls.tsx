import { commandById, formatKey, hint } from "../../shared/commands";
import { IS_MAC } from "../utils/platform";
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
import { TimeDisplay } from "./TimeDisplay";

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
  remaining: boolean;
  onToggleRemaining: () => void;
  /** The back/forward step buttons; the app routes these to the seekBack/seekForward commands. */
  onSeekStep: (dir: -1 | 1) => void;
}

const mac = IS_MAC;
const loopLabel = (loop: string) => `Loop: ${loop} (${formatKey(commandById("cycleLoop").keys![0], mac)})`;

export function Controls({ plan, player: p, visible, fullscreen, subs, onAudio, onFullscreen, onPip, onInfo, effectsActive, onEffects, queue, remaining, onToggleRemaining, onSeekStep }: Props) {
  return (
    <div className={`controls ${visible ? "" : "is-hidden"}`} onDoubleClick={(e) => e.stopPropagation()}>
      <SeekBar time={p.time} duration={p.duration} buffered={p.bufferedEnd} onSeek={p.seek} />
      <div className="controls-row">
        <div className="controls-group">
          <IconButton icon={p.paused ? "play" : "pause"} label={hint("togglePlay", mac)} onClick={p.toggle} />
          {queue.multi && <IconButton icon="skipPrev" label={hint("previous", mac)} onClick={queue.previous} />}
          {queue.multi && <IconButton icon="skipNext" label={hint("next", mac)} onClick={queue.next} />}
          <IconButton icon="back10" label={hint("seekBack", mac)} onClick={() => onSeekStep(-1)} />
          <IconButton icon="fwd10" label={hint("seekForward", mac)} onClick={() => onSeekStep(1)} />
          <IconButton icon={queue.loop === "one" ? "loopOne" : "loop"} label={loopLabel(queue.loop)} active={queue.loop !== "off"} onClick={queue.cycleLoop} />
          <VolumeControl volume={p.volume} muted={p.muted} onVolume={p.setVolume} onToggleMute={p.toggleMute} />
          <span className="vcr-status vcr-text vcr-text-md">{p.paused ? "PAUSE" : "PLAY"}</span>
          <TimeDisplay time={p.time} duration={p.duration} remaining={remaining} onToggle={onToggleRemaining} />
        </div>
        <div className="controls-group">
          {queue.multi && <QueuePanel queue={queue} />}
          <TrackMenus plan={plan} subs={subs} onAudio={onAudio} />
          <Dropdown
            icon="speed" label="Speed ([ and ])" selected={p.rate} onSelect={p.setRate}
            buttonText={`${p.rate}X`} options={SPEEDS.map((s) => ({ value: s, label: `${s}X` }))}
          />
          <IconButton icon="effects" label={hint("toggleEffectsPanel", mac)} active={effectsActive} onClick={onEffects} />
          <IconButton icon="info" label={hint("info", mac)} onClick={onInfo} />
          <IconButton icon="pip" label={hint("pip", mac)} onClick={onPip} />
          <IconButton icon={fullscreen ? "exitFullscreen" : "fullscreen"} label={hint("fullscreen", mac)} onClick={onFullscreen} />
        </div>
      </div>
    </div>
  );
}
