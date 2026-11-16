import { describe, expect, it } from "vitest";
import { pickPlayable } from "../electron/queue";
import {
  EMPTY_QUEUE, LOOP_MODES, autoAdvanceTarget, manualNext, nextIndex, nextLoopMode, previousTarget,
  queueReducer, reachedEnd, type QueueState,
} from "../renderer/utils/queue";

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
  it("append adds new items to the end and keeps the index", () => {
    expect(queueReducer(three, { type: "append", items: [item("d"), item("e")] })).toEqual({
      items: [item("a"), item("b"), item("c"), item("d"), item("e")],
      index: 1,
    });
  });
  it("append skips paths already queued, including duplicates within the list", () => {
    expect(queueReducer(three, { type: "append", items: [item("b"), item("d"), item("d")] })).toEqual({
      items: [item("a"), item("b"), item("c"), item("d")],
      index: 1,
    });
  });
  it("append with nothing new returns the same state", () => {
    expect(queueReducer(three, { type: "append", items: [item("a")] })).toBe(three);
    expect(queueReducer(three, { type: "append", items: [] })).toBe(three);
  });
  it("append to an empty queue starts at index 0", () => {
    expect(queueReducer(EMPTY_QUEUE, { type: "append", items: [item("x"), item("y")] })).toEqual({
      items: [item("x"), item("y")],
      index: 0,
    });
  });
});

describe("loop modes", () => {
  it("nextLoopMode cycles off -> all -> one -> off", () => {
    expect(nextLoopMode("off")).toBe("all");
    expect(nextLoopMode("all")).toBe("one");
    expect(nextLoopMode("one")).toBe("off");
    expect(LOOP_MODES).toEqual(["off", "one", "all"]);
  });
  it("autoAdvanceTarget: one replays the current item", () => {
    expect(autoAdvanceTarget(three, "one")).toBe(1);
    expect(autoAdvanceTarget({ ...three, index: 2 }, "one")).toBe(2);
  });
  it("autoAdvanceTarget: all advances and wraps to the first item", () => {
    expect(autoAdvanceTarget(three, "all")).toBe(2);
    expect(autoAdvanceTarget({ ...three, index: 2 }, "all")).toBe(0);
    expect(autoAdvanceTarget({ items: [item("a")], index: 0 }, "all")).toBe(0);
  });
  it("autoAdvanceTarget: off stops at the end", () => {
    expect(autoAdvanceTarget(three, "off")).toBe(2);
    expect(autoAdvanceTarget({ ...three, index: 2 }, "off")).toBeNull();
  });
  it("autoAdvanceTarget is null for an empty queue in every mode", () => {
    for (const m of LOOP_MODES) expect(autoAdvanceTarget(EMPTY_QUEUE, m)).toBeNull();
  });
  it("manualNext wraps only when looping all", () => {
    const last = { ...three, index: 2 };
    expect(manualNext(last, "all")).toBe(0);
    expect(manualNext(last, "off")).toBeNull();
    expect(manualNext(last, "one")).toBeNull();
    expect(manualNext(three, "one")).toBe(2);
    expect(manualNext(three, "off")).toBe(2);
  });
  it("manualNext is null for an empty queue", () => {
    expect(manualNext(EMPTY_QUEUE, "all")).toBeNull();
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

describe("reachedEnd", () => {
  it("is false mid-file even if <video> fired ended (disposed transcode)", () => {
    expect(reachedEnd(30, 2, 120)).toBe(false);
  });
  it("is true at the absolute end, including after a restart offset", () => {
    expect(reachedEnd(0, 119, 120)).toBe(true);
    expect(reachedEnd(100, 19.5, 120)).toBe(true);
  });
  it("trusts ended when the duration is unknown", () => {
    expect(reachedEnd(0, 5, 0)).toBe(true);
  });
});
