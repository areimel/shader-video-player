import { describe, expect, it } from "vitest";
import { resolveIncludes } from "../../renderer/shader/gl/includes";

const head = "#version 300 es\nprecision highp float;\n";

describe("resolveIncludes", () => {
  it("expands an include in place", () => {
    const out = resolveIncludes(`${head}#include "a"\nvoid main(){}`, { a: "float a = 1.0;" });
    expect(out).toBe(`${head}float a = 1.0;\nvoid main(){}`);
  });

  it("allows nesting and includes each chunk once", () => {
    const chunks = { a: '#include "c"\nA', b: '#include "c"\nB', c: "C" };
    const out = resolveIncludes(`${head}#include "a"\n#include "b"\n#include "a"`, chunks);
    expect(out.split("\n").slice(2)).toEqual(["C", "A", "B"]);
  });

  it("throws on unknown names", () => {
    expect(() => resolveIncludes(`${head}#include "nope"`, {})).toThrow(/Unknown include "nope"/);
  });

  it("throws on cycles", () => {
    const chunks = { a: '#include "b"', b: '#include "a"' };
    expect(() => resolveIncludes(`${head}#include "a"`, chunks)).toThrow(/cycle: a -> b -> a/);
  });

  it("keeps #version first and rejects it elsewhere", () => {
    expect(() => resolveIncludes(`\n#version 300 es`, {})).toThrow(/first line/);
    expect(() => resolveIncludes(`${head}#include "a"`, { a: "#version 300 es" })).toThrow(/first line/);
  });

  it("only treats a whole line as an include", () => {
    const src = `${head}// #include "x"\nint y;`;
    expect(resolveIncludes(src, {})).toBe(src);
  });
});
