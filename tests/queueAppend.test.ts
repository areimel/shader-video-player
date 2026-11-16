import { beforeEach, describe, expect, it } from "vitest";
import { appendToQueue, clearQueue, commitQueue, isQueued } from "../electron/queue";

const item = (path: string) => ({ path, name: path });
// Existing files, because isQueued also requires the path to exist.
const A = new URL(import.meta.url).pathname;
const B = A.replace("queueAppend", "queue");

describe("appendToQueue", () => {
  beforeEach(() => clearQueue());

  it("adds to the allow-set without replacing it", () => {
    commitQueue([item(A)]);
    expect(appendToQueue([item(B)])).toEqual([item(B)]);
    expect(isQueued(A)).toBe(true);
    expect(isQueued(B)).toBe(true);
  });

  it("commitQueue still replaces the set", () => {
    commitQueue([item(A)]);
    commitQueue([item(B)]);
    expect(isQueued(A)).toBe(false);
    expect(isQueued(B)).toBe(true);
  });

  it("is idempotent for paths already allowed", () => {
    commitQueue([item(A)]);
    expect(appendToQueue([item(A)])).toEqual([item(A)]);
  });

  it("caps the allow-set at 2000 entries", () => {
    const many = Array.from({ length: 2005 }, (_, i) => item(`/v/${i}.mp4`));
    expect(appendToQueue(many)).toHaveLength(2000);
    expect(appendToQueue([item("/v/extra.mp4")])).toEqual([]);
    expect(appendToQueue([many[0]])).toEqual([many[0]]);
  });

  it("clearQueue forgets everything", () => {
    commitQueue([item(A)]);
    clearQueue();
    expect(isQueued(A)).toBe(false);
  });
});
