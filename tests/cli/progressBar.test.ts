import { describe, expect, it } from "vitest";
import { createReporter, formatBar, formatEta } from "../../electron/cli/progressBar";

function fakeStream(tty: boolean, columns = 80) {
  const out: string[] = [];
  const stream = { isTTY: tty, columns, write: (s: string) => { out.push(s); return true; } };
  return { stream: stream as unknown as NodeJS.WriteStream, out };
}

describe("formatEta", () => {
  it("formats", () => {
    expect(formatEta(null)).toBe("");
    expect(formatEta(65)).toBe("1:05 left");
    expect(formatEta(9)).toBe("0:09 left");
    expect(formatEta(7200)).toBe("about 2 h left");
  });
});

describe("formatBar", () => {
  it("draws a determinate bar", () => {
    expect(formatBar(0.47, 65, "encoding", 20)).toBe("[#########...........]   47%  1:05 left  encoding");
  });
  it("omits eta when unknown and clamps", () => {
    expect(formatBar(2, null, "x", 4)).toBe("[####]  100%  x");
  });
  it("bounces when indeterminate", () => {
    const a = formatBar(null, null, "", 20, 0);
    const b = formatBar(null, null, "", 20, 5);
    expect(a).not.toBe(b);
    expect(a.match(/\[(.*)\]/)![1]).toHaveLength(20);
    expect(b.match(/\[(.*)\]/)![1]).toHaveLength(20);
  });
});

describe("createReporter", () => {
  it("redraws on a TTY, clipped, and ends with a newline", () => {
    const { stream, out } = fakeStream(true, 30);
    const r = createReporter(stream);
    r.update({ fraction: 0.5, etaSec: 10, label: "a very long label that overflows" });
    expect(out[0].startsWith("\r")).toBe(true);
    expect(out[0].length).toBeLessThanOrEqual(30);
    r.finish("done");
    expect(out.slice(1)).toEqual(["\n", "done\n"]);
  });
  it("prints plain lines every 5% or 10 s when not a TTY", () => {
    const { stream, out } = fakeStream(false);
    let t = 0;
    const r = createReporter(stream, () => t);
    r.update({ fraction: 0, etaSec: null, label: "" });
    r.update({ fraction: 0.02, etaSec: null, label: "" });
    r.update({ fraction: 0.06, etaSec: null, label: "" });
    expect(out).toHaveLength(2);
    t = 11_000;
    r.update({ fraction: 0.07, etaSec: null, label: "" });
    expect(out).toHaveLength(3);
    expect(out.every((l) => !l.includes("\r") && l.endsWith("\n"))).toBe(true);
  });
});
