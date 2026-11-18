import { describe, expect, it } from "vitest";
import { FrameChunker } from "../../electron/export/frameChunker";

const run = (frameBytes: number, chunks: number[][]) => {
  const out: number[][] = [];
  const c = new FrameChunker(frameBytes, (f) => out.push([...f]));
  for (const ch of chunks) c.push(Uint8Array.from(ch));
  return { out, c };
};

describe("FrameChunker", () => {
  it("handles several frames in one chunk", () => {
    expect(run(2, [[1, 2, 3, 4, 5, 6]]).out).toEqual([[1, 2], [3, 4], [5, 6]]);
  });
  it("joins frames across chunk boundaries and keeps leftovers", () => {
    const { out, c } = run(4, [[1], [2, 3], [4, 5, 6], [7, 8, 9]]);
    expect(out).toEqual([[1, 2, 3, 4], [5, 6, 7, 8]]);
    expect(c.pending).toBe(1);
  });
  it("completes a partial frame then emits whole frames from the same chunk", () => {
    expect(run(3, [[1, 2], [3, 4, 5, 6, 7, 8, 9]]).out).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
  });
  it("rejects a bad frame size", () => expect(() => new FrameChunker(0, () => {})).toThrow());
});
