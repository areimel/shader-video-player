import { describe, expect, it } from "vitest";
import { setPendingStart, takePendingStart } from "../renderer/utils/pendingStart";

describe("pendingStart", () => {
  it("is consumed once", () => {
    setPendingStart(12.5);
    expect(takePendingStart()).toBe(12.5);
    expect(takePendingStart()).toBeUndefined();
  });
  it("ignores invalid values", () => {
    setPendingStart(NaN);
    expect(takePendingStart()).toBeUndefined();
    setPendingStart(-1);
    expect(takePendingStart()).toBeUndefined();
  });
});
