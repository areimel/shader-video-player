/** True when `ordinal` names one of the file's audio tracks (0 is accepted for a file with none). */
export function validAudioOrdinal(ordinal: unknown, tracks: ReadonlyArray<{ ordinal: number }>): ordinal is number {
  if (typeof ordinal !== "number" || !Number.isInteger(ordinal) || ordinal < 0) return false;
  return tracks.length === 0 ? ordinal === 0 : tracks.some((t) => t.ordinal === ordinal);
}
