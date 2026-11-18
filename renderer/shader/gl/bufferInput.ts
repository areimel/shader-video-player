import type { FrameInput, FrameTick } from "./frameInput";
import type { Size } from "./passTypes";

/** A FrameInput fed by raw RGBA bytes (offline export). The owner sets `currentTime` per frame. */
export interface BufferInput extends FrameInput {
  /** Copies one RGBA frame (width*height*4 bytes) in and presents it as exactly one new frame. */
  push(bytes: Uint8Array | Uint8ClampedArray): void;
  /** Seconds returned by `time()`. */
  currentTime: number;
}

export function bufferInput(width: number, height: number): BufferInput {
  const image = new ImageData(width, height);
  const subs = new Set<(tick: FrameTick) => void>();
  const size: Size = { width, height };
  return {
    image,
    currentTime: 0,
    size: () => size,
    ready: () => true,
    subscribe(onFrame) {
      subs.add(onFrame);
      return () => { subs.delete(onFrame); };
    },
    playing: () => true,
    time() { return this.currentTime; },
    listen() { return () => {}; },
    push(bytes) {
      if (bytes.length !== image.data.length) throw new Error(`Expected ${image.data.length} bytes, got ${bytes.length}`);
      image.data.set(bytes);
      subs.forEach((cb) => cb({ image: true }));
    },
  };
}
