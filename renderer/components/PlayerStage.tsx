import type { MutableRefObject, RefObject } from "react";
import type { EffectSettings } from "../hooks/useEffectSettings";
import type { Panels } from "../hooks/usePanels";
import type { PlayerState } from "../hooks/usePlayerState";
import type { PlayQueue } from "../hooks/usePlayQueue";
import type { SubtitleState } from "../hooks/useSubtitles";
import type { PlaybackPlan, ToastKind } from "../types/player";
import { Controls } from "./Controls";
import { EndScreen } from "./EndScreen";
import { InfoPanel } from "./InfoPanel";
import { ShaderCanvas } from "./ShaderCanvas";
import { TopBar } from "./TopBar";
import { VideoView } from "./VideoView";
import { EffectsPanel } from "./effects/EffectsPanel";

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  plan: PlaybackPlan;
  initialTime: number;
  visible: boolean;
  player: PlayerState;
  fullscreen: { active: boolean; toggle: () => void };
  subs: SubtitleState;
  fx: EffectSettings;
  queue: PlayQueue;
  panels: Panels;
  onAudio: (ordinal: number) => void;
  onPip: () => void;
  onVideoError: (absTime: number) => void;
  onHome: () => void;
  notify: (kind: ToastKind, msg: string) => void;
  captureRef?: MutableRefObject<(() => Promise<Blob>) | null>;
}

/** Everything shown while a file is open: picture, top bar, controls, panels and the end screen. */
export function PlayerStage(p: Props) {
  const { plan, player, fullscreen: fs, fx, queue, panels, visible } = p;
  return (
    <>
      <VideoView
        videoRef={p.videoRef} plan={plan} initialTime={p.initialTime} subtitleUrl={p.subs.url} controlsVisible={visible} hidden={!!fx.effect}
        onToggle={player.toggle} onFullscreen={fs.toggle} onError={p.onVideoError}
      />
      <ShaderCanvas
        videoRef={p.videoRef} effect={fx.effect} values={fx.values} sourceKey={plan.url} captureRef={p.captureRef}
        onToggle={player.toggle} onFullscreen={fs.toggle}
        onError={(e) => { fx.setEffect(null); p.notify("error", e.message.split("\n")[0]); console.error(e); }}
      />
      {queue.ended && <EndScreen multi={queue.multi} onReplay={queue.replay} onPlayQueue={queue.playFromStart} onHome={p.onHome} />}
      <TopBar
        visible={visible} name={plan.info.name} onBack={p.onHome}
        position={queue.multi ? { index: queue.index, total: queue.items.length } : null}
      />
      <Controls
        plan={plan} player={player} visible={visible} fullscreen={fs.active} subs={p.subs}
        onAudio={p.onAudio} onFullscreen={fs.toggle} onPip={p.onPip}
        onInfo={panels.toggleInfo} effectsActive={!!fx.effect} onEffects={panels.toggleEffects} queue={queue}
      />
      {panels.showInfo && <InfoPanel plan={plan} onClose={panels.closeInfo} />}
      {panels.showEffects && <EffectsPanel fx={fx} onClose={panels.closeEffects} />}
    </>
  );
}
