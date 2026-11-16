/** "clip-00m12s.png" from the video's file name and playback time. */
export function screenshotName(videoName: string, timeSec: number): string {
  const stem = videoName.replace(/^.*[\\/]/, "").replace(/\.[^.]*$/, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f<>:"/\\|?*]/g, "_").replace(/\s+/g, "_").replace(/^\.+/, "").slice(0, 80) || "screenshot";
  const t = Math.max(0, Math.floor(Number.isFinite(timeSec) ? timeSec : 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${stem}-${h ? `${pad(h)}h` : ""}${pad(m)}m${pad(s)}s.png`;
}

/** The plain <video> frame at its native resolution (no effect). */
export function videoFrameToBlob(video: HTMLVideoElement): Promise<Blob> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return Promise.reject(new Error("No video frame to capture"));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Could not create a 2D canvas"));
  ctx.drawImage(video, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the frame"))), "image/png"));
}
