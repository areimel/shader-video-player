import { describe, expect, it } from "vitest";
import { OPEN_END_SPAN, streamHead, streamRangeStart } from "../electron/media/streamRange";

describe("streamRangeStart", () => {
  it("is null without a header", () => {
    expect(streamRangeStart(null)).toBeNull();
  });
  it("reads an open-ended range", () => {
    expect(streamRangeStart("bytes=0-")).toBe(0);
    expect(streamRangeStart("bytes=1146880-")).toBe(1146880);
  });
  it("reads a closed range from its first byte", () => {
    expect(streamRangeStart("bytes=10-20")).toBe(10);
  });
  it("is null for a suffix range", () => {
    expect(streamRangeStart("bytes=-500")).toBeNull();
  });
  it("is null for other units or garbage", () => {
    expect(streamRangeStart("items=0-")).toBeNull();
    expect(streamRangeStart("garbage")).toBeNull();
  });
  it("is null for a multi-range request", () => {
    expect(streamRangeStart("bytes=0-1,5-6")).toBeNull();
  });
});

describe("streamHead while the stream is still growing", () => {
  it.each([null, 0])("answers 200 with no length or range for start %s", (start) => {
    const h = streamHead(start, 4096, false);
    expect(h.status).toBe(200);
    expect(h.start).toBe(0);
    expect(h.headers["Accept-Ranges"]).toBe("bytes");
    expect(h.headers).not.toHaveProperty("Content-Length");
    expect(h.headers).not.toHaveProperty("Content-Range");
  });

  it("answers 206 with an open-ended Content-Range for a start past zero", () => {
    const h = streamHead(1000, 4096, false);
    expect(h.status).toBe(206);
    expect(h.start).toBe(1000);
    expect(h.headers["Content-Range"]).toBe(`bytes 1000-${1000 + OPEN_END_SPAN}/*`);
    expect(h.headers).not.toHaveProperty("Content-Length");
  });
});

describe("streamHead once the stream is done", () => {
  const size = 4096;

  it("answers 200 with the exact length when there is no range", () => {
    const h = streamHead(null, size, true);
    expect(h.status).toBe(200);
    expect(h.start).toBe(0);
    expect(h.headers["Content-Length"]).toBe(String(size));
    expect(h.headers).not.toHaveProperty("Content-Range");
  });

  it("answers 206 from the requested byte to the end", () => {
    const h = streamHead(1000, size, true);
    expect(h.status).toBe(206);
    expect(h.start).toBe(1000);
    expect(h.headers["Content-Range"]).toBe(`bytes 1000-${size - 1}/${size}`);
    expect(h.headers["Content-Length"]).toBe(String(size - 1000));
  });

  it("answers 206 for a range starting at zero", () => {
    const h = streamHead(0, size, true);
    expect(h.status).toBe(206);
    expect(h.start).toBe(0);
    expect(h.headers["Content-Range"]).toBe(`bytes 0-${size - 1}/${size}`);
    expect(h.headers["Content-Length"]).toBe(String(size));
  });

  it("answers 416 with the total size when the start is at or past the end", () => {
    expect(streamHead(size, size, true)).toMatchObject({
      status: 416,
      headers: { "Content-Range": `bytes */${size}` },
    });
    expect(streamHead(size + 10, size, true).status).toBe(416);
  });

  it("answers 200 with Content-Length 0 for an empty finished stream", () => {
    const h = streamHead(null, 0, true);
    expect(h.status).toBe(200);
    expect(h.headers["Content-Length"]).toBe("0");
  });
});
