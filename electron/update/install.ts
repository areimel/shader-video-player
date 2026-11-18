import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { USER_AGENT } from "./check";
import { parseSums, type Release } from "./releases";

const headers = { "User-Agent": USER_AGENT };

export async function cleanup(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

/** Node-only. Downloads the .deb, checks it against SHA256SUMS, makes it readable for `_apt`. */
export async function downloadAndVerify(
  release: Release,
  onProgress?: (fraction: number | null) => void,
): Promise<{ dir: string; debPath: string }> {
  const dir = await mkdtemp(join(tmpdir(), "svp-update-"));
  try {
    const sumsRes = await fetch(release.sumsUrl, { headers, signal: AbortSignal.timeout(30_000) });
    if (!sumsRes.ok) throw new Error(`Could not download SHA256SUMS (HTTP ${sumsRes.status}).`);
    const expected = parseSums(await sumsRes.text(), release.debName);
    if (!expected) throw new Error(`SHA256SUMS has no valid entry for ${release.debName}.`);

    const res = await fetch(release.debUrl, { headers });
    if (!res.ok || !res.body) throw new Error(`Could not download ${release.debName} (HTTP ${res.status}).`);
    const total = Number(res.headers.get("content-length")) || 0;
    const hash = createHash("sha256");
    let received = 0;
    const tap = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        hash.update(chunk);
        received += chunk.length;
        onProgress?.(total ? Math.min(1, received / total) : null);
        cb(null, chunk);
      },
    });
    const debPath = join(dir, release.debName);
    await pipeline(Readable.fromWeb(res.body as never), tap, createWriteStream(debPath));

    if (hash.digest("hex") !== expected) throw new Error(`Checksum mismatch for ${release.debName}; nothing was installed.`);
    await chmod(dir, 0o755);
    await chmod(debPath, 0o644);
    return { dir, debPath };
  } catch (e) {
    await cleanup(dir);
    throw e;
  }
}

/** Runs apt with the terminal attached (sudo may prompt). Resolves the exit code. */
export function installDeb(debPath: string): Promise<number> {
  const args = ["install", "-y", debPath];
  const child =
    process.getuid?.() === 0
      ? spawn("apt-get", args, { stdio: "inherit" })
      : spawn("sudo", ["apt-get", ...args], { stdio: "inherit" });
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });
}
