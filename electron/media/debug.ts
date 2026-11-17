/** Logs media plumbing (stream requests and Range headers, ffmpeg args, stderr, exits) when SVP_DEBUG_MEDIA is set. */
export function mediaDebug(msg: string): void {
  if (process.env.SVP_DEBUG_MEDIA) console.log(msg);
}
