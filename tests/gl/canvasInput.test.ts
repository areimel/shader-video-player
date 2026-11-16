import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canvasInput } from "../../renderer/shader/gl/canvasInput";
import type { FrameTick } from "../../renderer/shader/gl/frameInput";

const target = () => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() });

describe("canvasInput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("document", { ...target(), visibilityState: "visible", hasFocus: () => true });
    vi.stubGlobal("window", target());
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  function wired(canvas = { width: 640, height: 480 }) {
    const input = canvasInput(canvas as HTMLCanvasElement);
    const ticks: FrameTick[] = [];
    const resized = vi.fn();
    input.listen({ onJump: vi.fn(), onResized: resized, onPlayState: vi.fn() });
    input.subscribe((t) => ticks.push(t));
    return { input, ticks, resized, canvas };
  }

  it("uploads once per paint: a size change uploads in onResized and the tick only counts", () => {
    const { input, ticks, resized, canvas } = wired();
    input.painted();
    expect(resized).toHaveBeenCalledTimes(1);
    expect(ticks).toEqual([{ image: false }]);
    input.painted();
    expect(resized).toHaveBeenCalledTimes(1);
    expect(ticks.at(-1)).toEqual({ image: true });
    canvas.width = 800;
    input.painted();
    expect(resized).toHaveBeenCalledTimes(2);
    expect(ticks.at(-1)).toEqual({ image: false });
    input.dispose();
  });

  it("asks for the upload in the tick when nobody listens for the resize", () => {
    const input = canvasInput({ width: 640, height: 480 } as HTMLCanvasElement);
    const ticks: FrameTick[] = [];
    input.subscribe((t) => ticks.push(t));
    input.painted();
    expect(ticks).toEqual([{ image: true }]);
    input.dispose();
  });

  it("is playing only while attached, and never after dispose", () => {
    const bare = canvasInput({ width: 1, height: 1 } as HTMLCanvasElement);
    expect(bare.playing()).toBe(false);
    const { input } = wired();
    expect(input.playing()).toBe(true);
    input.dispose();
    expect(input.playing()).toBe(false);
  });
});
