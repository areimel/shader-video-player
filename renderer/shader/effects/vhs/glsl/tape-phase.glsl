// Subcarrier phase line for the VHS composite stage. Per-line effects work on field lines (see timebase.glsl), and
// NTSC flips the subcarrier by pi from one line of a field to the next, so the phase line is the field line, not the
// raster row. With 480 rows (stride 2) rows 2n and 2n+2 are adjacent lines of one field and differ by pi; the odd
// field is offset by one line. With 240 rows (stride 1) the row is the field line, as CRT's per-row phase.
// `stride` = d_fieldStride (rows per field line, derive.ts), rounded to an int by the caller. signal-encode and
// signal-decode must both use this, so the decoder reads the phase the encoder modulated.
int tapePhaseLine(int row, int stride) {
  return stride >= 2 ? row / stride + (row & 1) : row;
}
