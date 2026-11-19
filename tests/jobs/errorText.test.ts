import { describe, expect, it } from "vitest";
import { MAX_ERROR_CHARS, normalizeJobError } from "../../electron/jobs/errorText";

describe("normalizeJobError", () => {
  it("strips ERROR and extractor prefixes", () => {
    expect(normalizeJobError("ERROR: [youtube] aqz-KE-bpKQ: Video unavailable")).toBe("Video unavailable");
    expect(normalizeJobError("ERROR: [generic] Unsupported URL: https://x.test/")).toBe("Unsupported URL: https://x.test/");
  });
  it("collapses whitespace and newlines", () => {
    expect(normalizeJobError("a\n  b\t\tc  ")).toBe("a b c");
  });
  it("caps long text with an ellipsis", () => {
    const out = normalizeJobError("x ".repeat(200));
    expect(out.length).toBe(MAX_ERROR_CHARS);
    expect(out.endsWith("…")).toBe(true);
  });
  it("leaves short plain text alone and never returns empty", () => {
    expect(normalizeJobError("Disk full")).toBe("Disk full");
    expect(normalizeJobError("ERROR:  ")).toBe("Something went wrong");
  });
});
