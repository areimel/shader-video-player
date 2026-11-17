import { useCallback, useEffect, useRef, useState } from "react";
import { isSuperseded } from "../../shared/superseded";
import type { OpenResult, PlaybackPlan, QueueItem, ToastKind } from "../types/player";
import { friendlyError, mediaErrorText } from "../utils/format";
import { loadPosition } from "../utils/storage";

type Notify = (kind: ToastKind, msg: string) => void;
/** Called whenever the user opens something new, with the queue that selection forms. */
type OnQueue = (items: QueueItem[], index?: number) => void;

export const single = (plan: PlaybackPlan): QueueItem[] => [{ path: plan.info.path, name: plan.info.name }];

export function usePlaybackSource(notify: Notify, onQueue: OnQueue) {
  const [plan, setPlan] = useState<PlaybackPlan | null>(null);
  const [initialTime, setInitialTime] = useState(0);
  const [loading, setLoading] = useState(false);

  // Request ids: only the latest request may show a plan, and `loading` follows the latest request.
  const counter = useRef(0);
  const latest = useRef(0);
  const inflight = useRef(new Set<number>());
  const syncLoading = () => setLoading(inflight.current.has(latest.current));

  /** Applies saved position and the canPlayType check before showing a plan; false if superseded meanwhile. */
  const accept = useCallback(async (incoming: PlaybackPlan, id: number): Promise<boolean> => {
    let next = incoming;
    const saved = loadPosition(next.info);
    const canNative = next.mode === "native" && document.createElement("video").canPlayType(next.mime) !== "";
    if (next.mode === "native" && !canNative) next = await window.player.forceTranscode(saved);
    else if (next.mode === "transcode" && saved > 0) next = await window.player.restart(saved, 0);
    if (id !== latest.current) return false;
    setInitialTime(next.mode === "native" ? saved : 0);
    setPlan(next);
    return true;
  }, []);

  /** Resolves true when a plan was shown. Results and errors of superseded requests are ignored. */
  const run = useCallback(async (job: () => Promise<PlaybackPlan | null>, resume = true): Promise<boolean> => {
    const prev = latest.current;
    const id = ++counter.current;
    latest.current = id;
    inflight.current.add(id);
    syncLoading();
    try {
      const p = await job();
      if (!p) { // nothing was requested (dialog cancelled): the earlier request is the latest again
        if (latest.current === id) latest.current = prev;
        return false;
      }
      if (id !== latest.current) return false;
      if (resume) return await accept(p, id);
      setInitialTime(0);
      setPlan(p);
      return true;
    } catch (e) {
      if (!isSuperseded(e) && id === latest.current) notify("error", friendlyError(e));
      return false;
    } finally {
      inflight.current.delete(id);
      syncLoading();
    }
  }, [accept, notify]);

  useEffect(() => {
    const offPlan = window.player.onPlan((p) => void run(async () => p));
    const offQueue = window.player.onQueue(onQueue);
    const offErr = window.player.onError((m) => { if (!isSuperseded(m)) notify("error", friendlyError(m)); });
    window.player.ready();
    return () => { offPlan(); offQueue(); offErr(); };
  }, [run, notify, onQueue]);

  /** Opens a user selection (dialog / drop): the main process returns the first plan and the queue. */
  const openSelection = useCallback(async (job: () => Promise<OpenResult | null>): Promise<boolean> => {
    const got: { r?: OpenResult } = {};
    const ok = await run(async () => {
      got.r = (await job()) ?? undefined;
      return got.r?.plan ?? null;
    });
    if (ok && got.r) onQueue(got.r.queue, got.r.index); // only a selection that actually showed replaces the queue
    return ok;
  }, [run, onQueue]);

  const openDialog = useCallback(() => openSelection(() => window.player.openDialog()), [openSelection]);
  const openDropped = useCallback((files: File[]) => {
    return files.length ? openSelection(() => window.player.openDropped(files)) : Promise.resolve(false);
  }, [openSelection]);
  /** A library item: the main process queues its directory siblings and returns the index it opened at. */
  const openLibraryItem = useCallback((id: string) => openSelection(() => window.player.openLibraryItem(id)), [openSelection]);
  const openRecent = useCallback(async (p: string): Promise<boolean> => {
    const got: { plan?: PlaybackPlan } = {};
    const ok = await run(async () => (got.plan = await window.player.openRecent(p)));
    if (ok && got.plan) onQueue(single(got.plan));
    return ok;
  }, [run, onQueue]);
  /** Plays a queue item through the same single-file path; the main process only accepts paths it handed out. */
  const openQueued = useCallback((p: string) => run(() => window.player.openQueued(p)), [run]);
  const restartAt = useCallback(
    (t: number, audio: number) => run(() => window.player.restart(t, audio), false), [run],
  );

  /** Called when <video> errors: native files fall back to ffmpeg once. */
  const onVideoError = useCallback((absTime: number, detail?: string) => {
    if (plan?.mode === "native") {
      console.warn(`[playback] native playback failed, falling back to ffmpeg: ${detail ?? "no detail"}`);
      void run(() => window.player.forceTranscode(absTime), false);
    } else {
      console.error(`[playback] stream playback failed at ${absTime.toFixed(2)} s: ${detail ?? "no detail"}`);
      notify("error", mediaErrorText(detail));
    }
  }, [plan, run, notify]);

  const close = useCallback(() => {
    latest.current = ++counter.current; // drops any open still in flight
    window.player.closeMedia();
    setPlan(null);
    syncLoading();
  }, []);

  return { plan, initialTime, loading, openDialog, openRecent, openDropped, openLibraryItem, openQueued, restartAt, onVideoError, close };
}
