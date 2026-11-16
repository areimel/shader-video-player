import { describe, expect, it } from "vitest";
import { MAX_RECENTS, healRecents } from "../electron/recentsShape";

const r = (n: number) => ({ path: `/v/${n}.mp4`, name: `${n}.mp4`, openedAt: 1000 + n });

describe("healRecents", () => {
  it("keeps a valid list as is", () => {
    expect(healRecents([r(1), r(2)])).toEqual([r(1), r(2)]);
  });
  it("heals non-arrays to []", () => {
    for (const raw of [undefined, null, {}, "x", 4]) expect(healRecents(raw)).toEqual([]);
  });
  it("drops malformed entries and strips extra fields", () => {
    const raw = [
      r(1), null, "x", { path: 3, name: "a", openedAt: 1 }, { path: "rel.mp4", name: "a", openedAt: 1 },
      { path: "/v/n.mp4", name: 1, openedAt: 1 }, { path: "/v/t.mp4", name: "t", openedAt: Number.NaN },
      { ...r(2), extra: "y" },
    ];
    expect(healRecents(raw)).toEqual([r(1), r(2)]);
  });
  it("keeps the first of duplicate paths and caps the length", () => {
    expect(healRecents([r(1), { ...r(1), openedAt: 1 }])).toEqual([r(1)]);
    expect(healRecents(Array.from({ length: 20 }, (_, i) => r(i)))).toHaveLength(MAX_RECENTS);
  });
});
