import type { ReactNode, RefObject } from "react";
import type { PlaybackPlan, ToastKind } from "../types/player";
import type { EffectSettings } from "./useEffectSettings";
import type { Jobs } from "./useJobs";
import type { PlayerState } from "./usePlayerState";

/** Everything a feature hook (open URL, convert, export) may need. Add fields here, not in App.tsx. */
export interface FeatureDeps {
  notify: (kind: ToastKind, msg: string, action?: { label: string; run: () => void }) => void;
  /** The open file's plan, or null on the home screen. */
  plan: PlaybackPlan | null;
  /** Live playback state (position, paused, ...). */
  player: PlayerState;
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Effect state: the active effect id, its values and preset. */
  fx: EffectSettings;
  /** Background jobs; `open(id, startSec)` plays a finished job's file. */
  jobs: Jobs;
}

/** What a feature hook returns: the command handler and the dialog it may show (null when closed). */
export interface FeatureCommand {
  run: () => void;
  overlay: ReactNode | null;
}
