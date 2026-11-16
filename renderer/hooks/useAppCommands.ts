import { useCallback, type RefObject } from "react";
import { SEEK_LONG_SEC, SEEK_STEP_SEC } from "../../shared/commands";
import type { ToastKind } from "../types/player";
import { exitPip, togglePip } from "../utils/pip";
import type { EffectSettings } from "./useEffectSettings";
import type { Panels } from "./usePanels";
import type { PlayerState } from "./usePlayerState";
import type { CommandHandlers } from "./usePlayerShortcuts";
import type { PlayQueue } from "./usePlayQueue";
import type { SubtitleState } from "./useSubtitles";
import type { PlaybackPlan } from "../types/player";

interface Deps {
  videoRef: RefObject<HTMLVideoElement | null>;
  plan: PlaybackPlan | null;
  player: PlayerState;
  fs: { toggle: () => void; exit: () => void };
  fx: EffectSettings;
  subs: SubtitleState;
  queue: PlayQueue;
  panels: Panels;
  openDialog: () => void;
  /** usePlayQueue's `close`: drops playback and empties the queue. */
  closeMedia: () => void;
  /** Saves the current frame (with the active effect) as a PNG. */
  screenshot: () => Promise<void>;
  notify: (kind: ToastKind, msg: string) => void;
}

/**
 * Builds the command-id -> handler map shared by the keyboard and the native menu. Media commands exist only
 * while a file is open. Also returns `goHome`, the full reset used by Close, the top bar and the end screen:
 * clears the queue and end state, closes both panels, leaves fullscreen and picture in picture.
 */
export function useAppCommands(d: Deps): { commands: CommandHandlers; goHome: () => void } {
  const { plan, player, fs, fx, subs, queue, panels, videoRef, notify, closeMedia } = d;
  const goHome = useCallback(() => {
    closeMedia();
    panels.closeAll();
    fs.exit();
    exitPip();
  }, [closeMedia, panels.closeAll, fs.exit]);

  const media: CommandHandlers = plan ? {
    togglePlay: player.toggle,
    seekBack: () => player.seek(player.time - SEEK_STEP_SEC),
    seekForward: () => player.seek(player.time + SEEK_STEP_SEC),
    seekBackLong: () => player.seek(player.time - SEEK_LONG_SEC),
    seekForwardLong: () => player.seek(player.time + SEEK_LONG_SEC),
    volumeUp: () => player.setVolume(player.volume + 0.05),
    volumeDown: () => player.setVolume(player.volume - 0.05),
    mute: player.toggleMute,
    speedDown: () => player.stepRate(-1),
    speedUp: () => player.stepRate(1),
    ...(queue.multi && { next: queue.next, previous: queue.previous }),
    toggleEffect: fx.toggle,
    toggleEffectsPanel: panels.toggleEffects,
    fullscreen: fs.toggle,
    info: panels.toggleInfo,
    pip: () => togglePip(videoRef.current, notify),
    loadSubtitle: () => void subs.pickFile(),
    close: goHome,
    screenshot: () => void d.screenshot(),
    // TODO(coordinator): wire toggleRemaining, subtitleDelayDown, subtitleDelayUp here.
  } : {};
  const commands: CommandHandlers = {
    ...media,
    open: d.openDialog,
    addToQueue: () => void queue.addToQueue(),
    cycleLoop: queue.cycleLoop,
    // TODO(coordinator): wire shortcuts here (it must also work with nothing open).
  };
  return { commands, goHome };
}
