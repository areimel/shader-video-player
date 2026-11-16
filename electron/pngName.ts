import { basename } from "node:path";

export const MAX_PNG_BYTES = 64 * 1024 * 1024;
const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** True for a Uint8Array within the size limit that starts with the PNG signature. */
export function isPng(bytes: unknown): bytes is Uint8Array {
  if (!(bytes instanceof Uint8Array)) return false;
  if (bytes.length <= SIGNATURE.length || bytes.length > MAX_PNG_BYTES) return false;
  return SIGNATURE.every((b, i) => bytes[i] === b);
}

/** A plain basename ending in .png; falls back to "screenshot.png" for junk input. */
export function safePngName(name: unknown): string {
  const raw = typeof name === "string" ? basename(name.replace(/\\/g, "/")) : "";
  // eslint-disable-next-line no-control-regex
  const stem = raw.replace(/\.png$/i, "").replace(/[\x00-\x1f<>:"|?*]/g, "_").replace(/^\.+/, "").trim().slice(0, 120);
  return `${stem || "screenshot"}.png`;
}
