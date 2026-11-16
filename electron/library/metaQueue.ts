import type { ChildProcess } from "node:child_process";
import { readJson, writeJson } from "../jsonStore";
import { ffprobePath } from "../media/binaries";
import { INPUT_PROTOCOLS } from "../media/ffmpegArgs";
import { killProcess, spawnTracked } from "../media/processes";
import { currentVideoPath, onOpenStateChanged } from "../playback";
import { parseLightProbe, type LightMeta } from "./metaParse";
import { healMetaCache, metaFile, type MetaEntry } from "./shape";

/** Two probes keep a big first scan moving without competing much with the UI or a starting video. */
const CONCURRENCY = 2;
const TIMEOUT_MS = 15_000;
const BATCH_MS = 500;
const SAVE_MS = 3000;
/** The light probe prints a few hundred bytes; anything far bigger is not worth buffering. */
const MAX_STDOUT = 1024 * 1024;
const CACHE_FILE = "library-meta.json";

export interface MetaJob {
  id: string;
  /** Real path: the cache key, and what ffprobe reads. */
  path: string;
  size: number;
  mtimeMs: number;
}

export interface MetaResult {
  job: MetaJob;
  meta: LightMeta;
}

let cache: Map<string, MetaEntry> | null = null;
/** Timeouts and spawn failures: reported as failed for this session but not persisted, so a later run retries. */
const sessionFailed = new Set<string>();
const inFlight = new Map<string, ChildProcess | null>();
let pending: MetaJob[] = [];
let started = false;
let stopped = false;
let batch: MetaResult[] = [];
let batchTimer: NodeJS.Timeout | null = null;
let saveTimer: NodeJS.Timeout | null = null;
/** Paths in a complete index; null while a scan is running, so a half-built index never prunes the cache. */
let livePaths: Set<string> | null = null;
let listener: (results: MetaResult[]) => void = () => undefined;

const keyOf = (j: MetaJob) => `${j.path}\0${j.size}\0${j.mtimeMs}`;

function loadCache(): Map<string, MetaEntry> {
  cache ??= new Map(readJson(CACHE_FILE, healMetaCache).map((e) => [e.path, e]));
  return cache;
}

/** The cached result for this exact file version, or null when it still has to be probed. */
export function cachedMeta(job: MetaJob): LightMeta | null {
  const e = loadCache().get(job.path);
  if (e && e.size === job.size && e.mtimeMs === job.mtimeMs) {
    return e.ok ? { ok: true, durationSec: e.durationSec, width: e.width, height: e.height } : { ok: false };
  }
  return sessionFailed.has(keyOf(job)) ? { ok: false } : null;
}

export function onMetaResults(cb: (results: MetaResult[]) => void): void {
  listener = cb;
}

/** Replaces the pending work with `jobs` (the index's current uncached items). In-flight probes finish. */
export function scheduleMeta(jobs: readonly MetaJob[]): void {
  if (stopped) return;
  pending = jobs.filter((j) => cachedMeta(j) === null);
  pump();
}

/** Call with the full set of indexed paths once no scan is running; the persisted cache keeps only those. */
export function setLivePaths(paths: Iterable<string> | null): void {
  livePaths = paths ? new Set(paths) : null;
}

export function startMeta(): void {
  if (started) return;
  started = true;
  // Probing pauses while a video is open (it competes for disk and decoder) and resumes on close.
  onOpenStateChanged((open) => { if (!open) pump(); });
}

/** Quit: drop pending work, kill running probes and write the cache now. */
export function stopMeta(): void {
  stopped = true;
  pending = [];
  for (const child of inFlight.values()) killProcess(child);
  if (batchTimer) clearTimeout(batchTimer);
  if (saveTimer) clearTimeout(saveTimer);
  batchTimer = saveTimer = null;
  saveCache();
}

function pump(): void {
  while (!stopped && currentVideoPath() === null && inFlight.size < CONCURRENCY && pending.length) {
    const job = pending.shift()!;
    const key = keyOf(job);
    if (inFlight.has(key) || cachedMeta(job)) continue;
    inFlight.set(key, null);
    void probe(job, key).then((r) => {
      inFlight.delete(key);
      if (!stopped) record(job, r.meta, r.persist);
      pump();
    });
  }
}

function probe(job: MetaJob, key: string): Promise<{ meta: LightMeta; persist: boolean }> {
  const args = [
    "-v", "error", ...INPUT_PROTOCOLS,
    "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", job.path,
  ];
  return new Promise((resolve) => {
    let child: ChildProcess;
    try {
      child = spawnTracked(ffprobePath(), args, { stdout: true });
    } catch {
      resolve({ meta: { ok: false }, persist: false });
      return;
    }
    inFlight.set(key, child);
    let out = "";
    let killed = false;
    let done = false;
    const kill = () => { killed = true; killProcess(child); };
    const finish = (meta: LightMeta, persist: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ meta, persist });
    };
    const timer = setTimeout(kill, TIMEOUT_MS);
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (d: string) => { out += d; if (out.length > MAX_STDOUT) kill(); });
    child.stderr?.resume(); // drained so a chatty file cannot block the probe on a full pipe
    child.on("error", () => finish({ ok: false }, false));
    child.on("close", (code) => {
      // A killed or timed-out probe says nothing about the file, so it is retried on a later run.
      if (killed || code === null) finish({ ok: false }, false);
      else finish(code === 0 ? parseLightProbe(out) : { ok: false }, true);
    });
  });
}

function record(job: MetaJob, meta: LightMeta, persist: boolean): void {
  if (persist) {
    const base = { path: job.path, size: job.size, mtimeMs: job.mtimeMs };
    loadCache().set(job.path, meta.ok
      ? { ...base, ok: true, durationSec: meta.durationSec, width: meta.width, height: meta.height }
      : { ...base, ok: false, durationSec: null, width: null, height: null });
    saveTimer ??= setTimeout(() => { saveTimer = null; saveCache(); }, SAVE_MS);
  } else {
    sessionFailed.add(keyOf(job));
  }
  batch.push({ job, meta });
  batchTimer ??= setTimeout(flush, BATCH_MS);
}

function flush(): void {
  batchTimer = null;
  const out = batch;
  batch = [];
  if (out.length) listener(out);
}

function saveCache(): void {
  if (!cache) return;
  const live = livePaths;
  const entries = live ? [...cache.values()].filter((e) => live.has(e.path)) : cache.values();
  writeJson(CACHE_FILE, metaFile(entries));
}
