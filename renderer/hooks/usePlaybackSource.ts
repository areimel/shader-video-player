import { useCallback, useEffect, useState } from "react";
import type { OpenResult, PlaybackPlan, QueueItem, ToastKind } from "../types/player";
import { friendlyError } from "../utils/format";
import { loadPosition } from "../utils/storage";

type Notify = (kind: ToastKind, msg: string) => void;
/** Called whenever the user opens something new, with the queue that selection forms. */
type OnQueue = (items: QueueItem[]) => void;

const single = (plan: PlaybackPlan): QueueItem[] => [{ path: plan.info.path, name: plan.info.name }];

export function usePlaybackSource(notify: Notify, onQueue: OnQueue) {
  const [plan, setPlan] = useState<PlaybackPlan | null>(null);
  const [initialTime, setInitialTime] = useState(0);
  const [loading, setLoading] = useState(false);

  /** Applies saved position and the canPlayType check before showing a plan. */
  const accept = useCallback(async (incoming: PlaybackPlan) => {
    let next = incoming;
    const saved = loadPosition(next.info);
    const canNative = next.mode === "native" && document.createElement("video").canPlayType(next.mime) !== "";
    if (next.mode === "native" && !canNative) next = await window.player.forceTranscode(saved);
    else if (next.mode === "transcode" && saved > 0) next = await window.player.restart(saved, 0);
    setInitialTime(next.mode === "native" ? saved : 0);
    setPlan(next);
  }, []);

  /** Resolves true when a plan was shown. */
  const run = useCallback(async (job: () => Promise<PlaybackPlan | null>, resume = true): Promise<boolean> => {
    setLoading(true);
    try {
      const p = await job();
      if (!p) return false;
      if (resume) await accept(p);
      else { setInitialTime(0); setPlan(p); }
      return true;
    } catch (e) {
      notify("error", friendlyError(e));
      return false;
    } finally {
      setLoading(false);
    }
  }, [accept, notify]);

  useEffect(() => {
    const offPlan = window.player.onPlan((p) => void run(async () => p));
    const offQueue = window.player.onQueue(onQueue);
    const offErr = window.player.onError((m) => notify("error", friendlyError(m)));
    window.player.ready();
    return () => { offPlan(); offQueue(); offErr(); };
  }, [run, notify, onQueue]);

  /** Opens a user selection (dialog / drop): the main process returns the first plan and the queue. */
  const openSelection = useCallback((job: () => Promise<OpenResult | null>) => run(async () => {
    const r = await job();
    if (!r) return null;
    onQueue(r.queue);
    return r.plan;
  }), [run, onQueue]);

  const openDialog = useCallback(() => openSelection(() => window.player.openDialog()), [openSelection]);
  const openDropped = useCallback((files: File[]) => {
    return files.length ? openSelection(() => window.player.openDropped(files)) : Promise.resolve(false);
  }, [openSelection]);
  const openRecent = useCallback((p: string) => run(async () => {
    const plan = await window.player.openRecent(p);
    onQueue(single(plan));
    return plan;
  }), [run, onQueue]);
  /** Plays a queue item through the same single-file path; the main process only accepts paths it handed out. */
  const openQueued = useCallback((p: string) => run(() => window.player.openQueued(p)), [run]);
  const restartAt = useCallback(
    (t: number, audio: number) => run(() => window.player.restart(t, audio), false), [run],
  );

  /** Called when <video> errors: native files fall back to ffmpeg once. */
  const onVideoError = useCallback((absTime: number) => {
    if (plan?.mode === "native") {
      void run(() => window.player.forceTranscode(absTime), false);
    } else {
      notify("error", "This file couldn't be played. It may be corrupt or unsupported.");
    }
  }, [plan, run, notify]);

  const close = useCallback(() => { window.player.closeMedia(); setPlan(null); }, []);

  return { plan, initialTime, loading, openDialog, openRecent, openDropped, openQueued, restartAt, onVideoError, close };
}
