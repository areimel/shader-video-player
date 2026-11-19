/**
 * Splits a byte stream into frames of exactly `frameBytes`. A frame that sits whole inside one chunk
 * is handed out as a view of it; one that spans chunks goes through a single reused accumulator.
 * Either way the frame is only valid until `onFrame` returns.
 */
export class FrameChunker {
  private readonly acc: Uint8Array;
  private filled = 0;

  constructor(readonly frameBytes: number, private readonly onFrame: (frame: Uint8Array) => void) {
    if (!Number.isInteger(frameBytes) || frameBytes <= 0) throw new Error("frameBytes must be a positive integer");
    this.acc = new Uint8Array(frameBytes);
  }

  push(chunk: Uint8Array): void {
    let pos = 0;
    if (this.filled > 0) {
      const take = Math.min(this.frameBytes - this.filled, chunk.length);
      this.acc.set(chunk.subarray(0, take), this.filled);
      this.filled += take;
      pos = take;
      if (this.filled < this.frameBytes) return;
      this.filled = 0;
      this.onFrame(this.acc);
    }
    while (chunk.length - pos >= this.frameBytes) {
      this.onFrame(chunk.subarray(pos, pos + this.frameBytes));
      pos += this.frameBytes;
    }
    if (pos < chunk.length) {
      this.acc.set(chunk.subarray(pos), 0);
      this.filled = chunk.length - pos;
    }
  }

  /** Bytes of an incomplete trailing frame (dropped at the end of the stream). */
  get pending(): number {
    return this.filled;
  }
}
