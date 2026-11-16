import { describe, expect, it } from "vitest";
import { COMMANDS, commandById, formatKey, hint, isCommandId, parseKey, toAccelerator } from "../shared/commands";

describe("commands table", () => {
  it("has unique ids", () => {
    const ids = COMMANDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("has unique keys", () => {
    const keys = COMMANDS.flatMap((c) => ("keys" in c ? [...c.keys] : []) as string[]);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("every key and accelerator parses and formats", () => {
    for (const c of COMMANDS) {
      const all = [...(("keys" in c ? c.keys : []) as readonly string[]), ...("accelerator" in c ? [c.accelerator] : [])];
      for (const k of all) {
        expect(parseKey(k).key.length).toBeGreaterThan(0);
        expect(formatKey(k, false)).not.toBe("");
        expect(toAccelerator(k)).toBeTruthy();
      }
    }
  });
});

describe("formatKey", () => {
  it("formats non-mac", () => {
    expect(formatKey("CmdOrCtrl+O", false)).toBe("Ctrl+O");
    expect(formatKey(" ", false)).toBe("Space");
    expect(formatKey("ArrowLeft", false)).toBe("←");
    expect(formatKey("Shift+E", false)).toBe("Shift+E");
    expect(formatKey("m", false)).toBe("M");
    expect(formatKey("?", false)).toBe("?");
    expect(formatKey("Shift+ArrowLeft", false)).toBe("Shift+←");
  });
  it("formats mac", () => {
    expect(formatKey("CmdOrCtrl+O", true)).toBe("⌘O");
    expect(formatKey("Shift+E", true)).toBe("⇧E");
    expect(formatKey("CmdOrCtrl+Shift+S", true)).toBe("⌘⇧S");
    expect(formatKey(" ", true)).toBe("Space");
  });
});

describe("helpers", () => {
  it("isCommandId", () => {
    expect(isCommandId("togglePlay")).toBe(true);
    expect(isCommandId("nope")).toBe(false);
    expect(isCommandId(3)).toBe(false);
  });
  it("hint prefers key then accelerator", () => {
    expect(hint("togglePlay")).toBe("Play / Pause (Space)");
    expect(hint("open")).toBe("Open… (Ctrl+O)");
    expect(hint("pip")).toBe("Picture in picture");
    expect(commandById("screenshot").keys).toEqual(["s"]);
    expect(hint("screenshot")).toBe("Screenshot (S)");
  });
});
