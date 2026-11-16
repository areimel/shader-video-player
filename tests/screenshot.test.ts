import { describe, expect, it } from "vitest";
import { isPng, MAX_PNG_BYTES, safePngName } from "../electron/pngName";
import { screenshotName } from "../renderer/utils/capture";

const png = (n = 16) => {
  const b = new Uint8Array(n);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return b;
};

describe("screenshotName", () => {
  it("combines the stem and time", () => {
    expect(screenshotName("clip.mp4", 12.9)).toBe("clip-00m12s.png");
    expect(screenshotName("/a/b/My Movie.final.mkv", 3725)).toBe("My_Movie.final-01h02m05s.png");
  });
  it("sanitizes", () => {
    expect(screenshotName('a<b>:"c".mp4', -5)).toBe("a_b___c_-00m00s.png");
    expect(screenshotName("", NaN)).toBe("screenshot-00m00s.png");
  });
});

describe("isPng", () => {
  it("accepts PNG bytes", () => expect(isPng(png())).toBe(true));
  it("rejects non-PNG, wrong types and oversize", () => {
    expect(isPng(new Uint8Array(16))).toBe(false);
    expect(isPng("x")).toBe(false);
    expect(isPng(png(8))).toBe(false);
    expect(isPng({ length: 20 })).toBe(false);
    expect(isPng(png(MAX_PNG_BYTES + 1))).toBe(false);
  });
});

describe("safePngName", () => {
  it("keeps a basename ending in .png", () => {
    expect(safePngName("clip.png")).toBe("clip.png");
    expect(safePngName("clip")).toBe("clip.png");
  });
  it("strips directories and junk", () => {
    expect(safePngName("../../etc/passwd")).toBe("passwd.png");
    expect(safePngName("C:\\x\\y.PNG")).toBe("y.png");
    expect(safePngName("..")).toBe("screenshot.png");
    expect(safePngName(42)).toBe("screenshot.png");
  });
});
