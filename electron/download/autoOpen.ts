/**
 * A finished download starts playing by itself only when nothing is open and no open, restart or close
 * happened since the download began (an open still in flight has already bumped the playback generation);
 * otherwise the job card keeps its Open action.
 */
export function shouldAutoOpen(openPath: string | null, generationAtStart: number, generationNow: number): boolean {
  return openPath === null && generationAtStart === generationNow;
}
