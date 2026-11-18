export type {
  AudioTrack, SubtitleTrack, ExternalSubtitle, MediaInfo, PlaybackPlan, RecentFile, PlayerBridge,
  QueueItem, OpenResult,
} from "../../shared/types";

export type ToastKind = "success" | "error";

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  /** Optional button next to the message (e.g. "Open"). Clicking runs it and dismisses the toast. */
  action?: ToastAction;
}
