import { useCallback, type RefObject } from "react";
import { SEEK_LONG_SEC, SEEK_STEP_SEC } from "../../shared/commands";
import type { ToastKind } from "../types/player";
import { exitPip, togglePip } from "../utils/pip";
import type { FeatureCommands } from "./useFeatureCommands";
import { nextLoopMode } from "../utils/queue";
import type { ShowOsd } from "./useOsd";
import { steppedRate } from "./useOsd";
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
  /** Library folder picker (the native menu's File > Add folder). */
  addFolder: () => void;
  /** usePlayQueue's `close`: drops playback and empties the queue. */
  closeMedia: () => void;
  /** Saves the current frame (with the active effect) as a PNG. */
  screenshot: () => Promise<void>;
  toggleRemaining: () => void;
  toggleShortcuts: () => void;
  showOsd: ShowOsd;
  notify: (kind: ToastKind, msg: string) => void;
  /** Open URL, convert and export handlers from useFeatureCommands. */
  feature: FeatureCommands["commands"];
}

/**
 * Builds the command-id -> handler map shared by the keyboard and the native menu. Media commands exist only
 * while a file is open; the effect toggle and fullscreen work on the home screen too. Also returns `goHome`, the full reset used by Close, the top bar and the end screen:
 * clears the queue and end state, closes both panels, leaves fullscreen and picture in picture.
 */
export function useAppCommands(d: Deps): { commands: CommandHandlers; goHome: () => void } {
  const { plan, player, fs, fx, subs, queue, panels, videoRef, notify, closeMedia, showOsd } = d;
  const skip = (delta: number) => {
    player.seek(player.time + delta);
    showOsd({ kind: "transport", op: delta > 0 ? "ff" : "rew", seconds: Math.abs(delta) });
  };
  const volume = (n: number) => {
    player.setVolume(n);
    showOsd({ kind: "volume", level: Math.min(1, Math.max(0, n)), muted: false });
  };
  const goHome = useCallback(() => {
    closeMedia();
    panels.closeAll();
    fs.exit();
    exitPip();
  }, [closeMedia, panels.closeAll, fs.exit]);

  const media: CommandHandlers = plan ? {
    togglePlay: () => { player.toggle(); showOsd({ kind: "transport", op: player.paused ? "play" : "pause" }); },
    seekBack: () => skip(-SEEK_STEP_SEC),
    seekForward: () => skip(SEEK_STEP_SEC),
    seekBackLong: () => skip(-SEEK_LONG_SEC),
    seekForwardLong: () => skip(SEEK_LONG_SEC),
    volumeUp: () => volume(player.volume + 0.05),
    volumeDown: () => volume(player.volume - 0.05),
    mute: () => { player.toggleMute(); showOsd({ kind: "volume", level: player.volume, muted: !player.muted }); },
    speedDown: () => { player.stepRate(-1); showOsd({ kind: "speed", rate: steppedRate(player.rate, -1) }); },
    speedUp: () => { player.stepRate(1); showOsd({ kind: "speed", rate: steppedRate(player.rate, 1) }); },
    ...(queue.multi && {
      next: () => { queue.next(); showOsd({ kind: "transport", op: "next" }); },
      previous: () => { queue.previous(); showOsd({ kind: "transport", op: "prev" }); },
    }),
    toggleEffectsPanel: panels.toggleEffects,
    info: panels.toggleInfo,
    pip: () => togglePip(videoRef.current, notify),
    loadSubtitle: () => void subs.pickFile(),
    close: goHome,
    convert: d.feature.convert,
    exportVideo: d.feature.exportVideo,
    screenshot: () => void d.screenshot(),
    toggleRemaining: d.toggleRemaining,
    subtitleDelayDown: () => showOsd({ kind: "subDelay", seconds: subs.stepDelay(-1) }),
    subtitleDelayUp: () => showOsd({ kind: "subDelay", seconds: subs.stepDelay(1) }),
  } : {};
  const commands: CommandHandlers = {
    ...media,
    open: d.openDialog,
    openUrl: d.feature.openUrl,
    addFolder: d.addFolder,
    // These two also work on the home screen (it is drawn through the effect).
    toggleEffect: fx.toggle,
    fullscreen: fs.toggle,
    addToQueue: () => void queue.addToQueue(),
    cycleLoop: () => { queue.cycleLoop(); if (plan) showOsd({ kind: "loop", mode: nextLoopMode(queue.loop) }); },
    shortcuts: d.toggleShortcuts,
  };
  return { commands, goHome };
}
