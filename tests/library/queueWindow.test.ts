import { describe, expect, it } from "vitest";
import { MAX_QUEUE } from "../../electron/queue";
import { windowAround } from "../../electron/library/queueWindow";

const list = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("windowAround", () => {
  it("returns the whole list when it fits", () => {
    expect(windowAround(list(5), 0, 10)).toEqual({ items: list(5), index: 0 });
    expect(windowAround(list(5), 2, 10)).toEqual({ items: list(5), index: 2 });
    expect(windowAround(list(5), 4, 5)).toEqual({ items: list(5), index: 4 });
  });
  it("prefers the item and what follows, at the start, middle and end", () => {
    expect(windowAround(list(10), 0, 4)).toEqual({ items: [0, 1, 2, 3], index: 0 });
    expect(windowAround(list(10), 5, 4)).toEqual({ items: [5, 6, 7, 8], index: 0 });
    expect(windowAround(list(10), 8, 4)).toEqual({ items: [6, 7, 8, 9], index: 2 });
    expect(windowAround(list(10), 9, 4)).toEqual({ items: [6, 7, 8, 9], index: 3 });
  });
  it("keeps a clicked item beyond MAX_QUEUE inside the window", () => {
    const big = list(5000);
    for (const i of [0, 1999, 2000, 2500, 4999]) {
      const w = windowAround(big, i, MAX_QUEUE);
      expect(w.items).toHaveLength(MAX_QUEUE);
      expect(w.items[w.index]).toBe(i);
      expect(w.items[1] - w.items[0]).toBe(1); // still consecutive, natural order kept
    }
  });
  it("rejects an index outside the list", () => {
    expect(windowAround(list(3), 3, 10).index).toBe(-1);
    expect(windowAround(list(3), -1, 10).index).toBe(-1);
    expect(windowAround([], 0, 10).items).toEqual([]);
  });
});
