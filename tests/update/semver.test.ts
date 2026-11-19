import { describe, expect, it } from "vitest";
import { compareVersions, parseVersion } from "../../electron/update/semver";

describe("parseVersion", () => {
  it("parses plain and v-prefixed versions", () => {
    expect(parseVersion("0.3.0")).toEqual({ major: 0, minor: 3, patch: 0, pre: [] });
    expect(parseVersion("v0.4.0-beta.1")).toEqual({ major: 0, minor: 4, patch: 0, pre: ["beta", 1] });
  });
  it("rejects junk", () => {
    expect(parseVersion("")).toBeNull();
    expect(parseVersion("1.2")).toBeNull();
    expect(parseVersion("latest")).toBeNull();
    expect(parseVersion("1.2.3-")).toBeNull();
  });
});

describe("compareVersions", () => {
  it("orders numerically", () => {
    expect(compareVersions("0.3.0", "0.10.0")).toBe(-1);
    expect(compareVersions("1.0.0", "0.9.9")).toBe(1);
    expect(compareVersions("v1.0.0", "1.0.0")).toBe(0);
  });
  it("puts pre-releases before releases", () => {
    expect(compareVersions("1.0.0-rc.1", "1.0.0")).toBe(-1);
    expect(compareVersions("1.0.0", "1.0.0-rc.1")).toBe(1);
  });
  it("compares pre-release identifiers", () => {
    expect(compareVersions("1.0.0-beta.2", "1.0.0-beta.11")).toBe(-1);
    expect(compareVersions("1.0.0-alpha", "1.0.0-beta")).toBe(-1);
    expect(compareVersions("1.0.0-1", "1.0.0-alpha")).toBe(-1);
    expect(compareVersions("1.0.0-beta", "1.0.0-beta.1")).toBe(-1);
    expect(compareVersions("1.0.0-beta.1", "1.0.0-beta.1")).toBe(0);
  });
  it("throws on invalid input", () => {
    expect(() => compareVersions("x", "1.0.0")).toThrow();
  });
});
