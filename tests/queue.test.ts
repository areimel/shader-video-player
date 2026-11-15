import { describe, expect, it } from "vitest";
import { pickPlayable } from "../electron/queue";
import { EMPTY_QUEUE, nextIndex, previousTarget, queueReducer, type QueueState } from "../renderer/utils/queue";

const item = (n: string) => ({ path: `/v/${n}.mp4`, name: `${n}.mp4` });
const three: QueueState = { items: [item("a"), item("b"), item("c")], index: 1 };

describe("queueReducer", () => {
  it("replace starts at the first item and clamps a given index", () => {
    expect(queueReducer(three, { type: "replace", items: [item("x"), item("y")] })).toEqual({ items: [item("x"), item("y")], index: 0 });
    expect(queueReducer(EMPTY_QUEUE, { type: "replace", items: [item("x")], index: 9 }).index).toBe(0);
    expect(queueReducer(three, { type: "replace", items: [] })).toEqual(EMPTY_QUEUE);
  });
  it("next and previous stay within bounds", () => {
    expect(queueReducer(three, { type: "next" }).index).toBe(2);
    expect(queueReducer({ ...three, index: 2 }, { type: "next" })).toEqual({ ...three, index: 2 });
    expect(queueReducer(three, { type: "previous" }).index).toBe(0);
    expect(queueReducer({ ...three, index: 0 }, { type: "previous" }).index).toBe(0);
  });
  it("jumpTo ignores out-of-range indices", () => {
    expect(queueReducer(three, { type: "jumpTo", index: 2 }).index).toBe(2);
    expect(queueReducer(three, { type: "jumpTo", index: 3 })).toBe(three);
    expect(queueReducer(three, { type: "jumpTo", index: -1 })).toBe(three);
  });
  it("remove shifts the current index and never removes the playing item", () => {
    expect(queueReducer(three, { type: "remove", index: 0 })).toEqual({ items: [item("b"), item("c")], index: 0 });
    expect(queueReducer(three, { type: "remove", index: 2 })).toEqual({ items: [item("a"), item("b")], index: 1 });
    expect(queueReducer(three, { type: "remove", index: 1 })).toBe(three);
    expect(queueReducer(three, { type: "remove", index: 7 })).toBe(three);
  });
  it("clear empties the queue", () => {
    expect(queueReducer(three, { type: "clear" })).toEqual(EMPTY_QUEUE);
  });
});

describe("queue navigation helpers", () => {
  it("nextIndex is null at the end", () => {
    expect(nextIndex(three)).toBe(2);
    expect(nextIndex({ ...three, index: 2 })).toBeNull();
    expect(nextIndex(EMPTY_QUEUE)).toBeNull();
  });
  it("previousTarget restarts after 3 s or at the first item", () => {
    expect(previousTarget(three, 3.5)).toBe(1);
    expect(previousTarget(three, 3)).toBe(0);
    expect(previousTarget(three, 0.5)).toBe(0);
    expect(previousTarget({ ...three, index: 0 }, 1)).toBe(0);
  });
});

describe("pickPlayable", () => {
  it("keeps a lone file whatever its extension", () => {
    expect(pickPlayable(["/v/odd.xyz"])).toEqual(["/v/odd.xyz"]);
  });
  it("filters several files to supported extensions, preserving order", () => {
    expect(pickPlayable(["/v/b.MKV", "/v/notes.txt", "/v/a.mp4", "/v/subs.srt"])).toEqual(["/v/b.MKV", "/v/a.mp4"]);
  });
  it("drops non-strings and empties", () => {
    expect(pickPlayable([42, "", null, "/v/a.mp4"])).toEqual(["/v/a.mp4"]);
  });
});
