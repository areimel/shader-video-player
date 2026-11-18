import type { LoopMode } from "./queue";

/** Transient VCR on-screen display: status top-left, volume bar at the bottom. Pure and DOM-free. */
export type OsdEvent =
  | { kind: "transport"; op: "play" | "pause" | "ff" | "rew" | "next" | "prev"; seconds?: number }
  | { kind: "volume"; level: number; muted: boolean }
  | { kind: "speed"; rate: number }
  | { kind: "loop"; mode: LoopMode }
  | { kind: "subDelay"; seconds: number };

export type OsdGlyph = "play" | "pause" | "fwd10" | "back10" | "skipNext" | "skipPrev";
export interface OsdSlot { event: OsdEvent; until: number }
export interface OsdState { status: OsdSlot | null; level: OsdSlot | null }
export type OsdAction = { type: "show"; event: OsdEvent; now: number } | { type: "expire"; now: number };

export const STATUS_MS = 2000;
export const VOLUME_MS = 1500;
export const OSD_INITIAL: OsdState = { status: null, level: null };

export function osdReducer(s: OsdState, a: OsdAction): OsdState {
  if (a.type === "show") {
    if (a.event.kind === "volume") return { ...s, level: { event: a.event, until: a.now + VOLUME_MS } };
    return { ...s, status: { event: a.event, until: a.now + STATUS_MS } };
  }
  const status = s.status && s.status.until <= a.now ? null : s.status;
  const level = s.level && s.level.until <= a.now ? null : s.level;
  return status === s.status && level === s.level ? s : { status, level };
}

/** Earliest time a slot expires, so a hook can arm one timeout. */
export function nextExpiry(s: OsdState): number | null {
  const times = [s.status?.until, s.level?.until].filter((t): t is number => t !== undefined);
  return times.length ? Math.min(...times) : null;
}

const TRANSPORT: Record<string, { word: string; glyph: OsdGlyph; sign: string }> = {
  play: { word: "PLAY", glyph: "play", sign: "" },
  pause: { word: "PAUSE", glyph: "pause", sign: "" },
  ff: { word: "FF", glyph: "fwd10", sign: "+" },
  rew: { word: "REW", glyph: "back10", sign: "-" },
  next: { word: "NEXT", glyph: "skipNext", sign: "" },
  prev: { word: "PREV", glyph: "skipPrev", sign: "" },
};

/** Status-slot text in VCR caps; the glyph is an icon token (Press Start 2P lacks symbols). */
export function statusText(e: OsdEvent): { label: string; glyph: OsdGlyph | null } {
  switch (e.kind) {
    case "transport": {
      const t = TRANSPORT[e.op];
      const amount = e.seconds !== undefined ? ` ${t.sign}${Math.abs(Math.round(e.seconds))}S` : "";
      return { label: t.word + amount, glyph: t.glyph };
    }
    case "volume":
      return { label: e.muted ? "MUTE" : `VOLUME ${volumeNumber(e.level)}`, glyph: null };
    case "speed":
      return { label: `SPEED ${Number(e.rate.toFixed(2))}X`, glyph: null };
    case "loop":
      return { label: `REPEAT ${e.mode.toUpperCase()}`, glyph: null };
    case "subDelay": {
      const v = Math.round(e.seconds * 10) / 10;
      return { label: `SUB DELAY ${v > 0 ? "+" : ""}${v.toFixed(1).replace("-0.0", "0.0")}S`, glyph: null };
    }
  }
}

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

export function volumeSegments(level: number, total = 16): number {
  return Math.round(clamp01(level) * total);
}

export function volumeNumber(level: number): number {
  return Math.round(clamp01(level) * 100);
}

/** VCR tape counter, always H:MM:SS (formatTime drops the hour). */
export function formatCounter(seconds: number): string {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const two = (n: number) => String(n).padStart(2, "0");
  return `${Math.floor(s / 3600)}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`;
}
