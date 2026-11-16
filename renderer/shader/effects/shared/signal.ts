/** NTSC timing used to turn MHz into cycles per raster sample (Nyquist = 0.5). */
export const ACTIVE_LINE_US = 52.6;
export const SUBCARRIER_MHZ = 3.579545;

/** Cycles per sample of 1 MHz on a line of `samplesPerLine` samples. */
export const mhzToCycles = (samplesPerLine: number): number => ACTIVE_LINE_US / samplesPerLine;

/** Colour subcarrier frequency in cycles per sample. Needs samplesPerLine > ~377 to stay below Nyquist. */
export const subcarrierCycles = (samplesPerLine: number): number => SUBCARRIER_MHZ * mhzToCycles(samplesPerLine);

/** A filter cutoff in cycles per sample, clamped to Nyquist. */
export const cutoffCycles = (mhz: number, samplesPerLine: number): number => Math.min(0.5, mhz * mhzToCycles(samplesPerLine));
