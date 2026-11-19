import { app } from "electron";
import { access, mkdir, constants } from "node:fs/promises";
import { join } from "node:path";

/** `<Videos>/Shader Video Player`, created on demand (getPath("videos") may fall back to $HOME). */
export async function appVideosDir(): Promise<string> {
  const dir = join(app.getPath("videos"), "Shader Video Player");
  await mkdir(dir, { recursive: true });
  return dir;
}

/** `dir` when it is writable, else `fallback`. */
export async function writableDirOr(dir: string, fallback: string): Promise<string> {
  try {
    await access(dir, constants.W_OK);
    return dir;
  } catch {
    return fallback;
  }
}
