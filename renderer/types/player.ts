export type {
  AudioTrack, SubtitleTrack, MediaInfo, PlaybackPlan, RecentFile, PlayerBridge,
} from "../../shared/types";

export type ToastKind = "success" | "error";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}
