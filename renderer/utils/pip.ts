import type { ToastKind } from "../types/player";

export function exitPip(): void {
  if (document.pictureInPictureElement) void document.exitPictureInPicture().catch(() => undefined);
}

export function togglePip(video: HTMLVideoElement | null, notify: (kind: ToastKind, msg: string) => void): void {
  const job = document.pictureInPictureElement ? document.exitPictureInPicture() : video?.requestPictureInPicture();
  job?.catch(() => notify("error", "Picture in picture isn't available."));
}
