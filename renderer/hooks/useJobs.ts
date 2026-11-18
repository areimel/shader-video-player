import { useCallback, useEffect, useReducer, useRef } from "react";
import type { JobSnapshot } from "../../shared/jobs";
import type { ToastKind } from "../types/player";
import { friendlyError } from "../utils/format";
import { AUTO_DISMISS_MS, EMPTY_JOBS, jobsReducer } from "../utils/jobs";

export interface Jobs {
  jobs: JobSnapshot[];
  dismiss: (id: string) => void;
  cancel: (id: string) => void;
  open: (id: string, startSec?: number) => void;
  reveal: (id: string) => void;
}

/** Background jobs from the main process: the list, auto-dismiss timers and the card actions. */
export function useJobs(notify: (kind: ToastKind, msg: string) => void): Jobs {
  const [state, dispatch] = useReducer(jobsReducer, EMPTY_JOBS);
  const timers = useRef(new Map<string, { state: string; timer: ReturnType<typeof setTimeout> }>());

  useEffect(() => {
    const off = window.player.onJob((job) => dispatch({ type: "upsert", job }));
    window.player.listJobs().then((jobs) => dispatch({ type: "load", jobs }), () => undefined);
    return off;
  }, []);

  const dismiss = useCallback((id: string) => dispatch({ type: "dismiss", id }), []);

  // One timer per card and state; a state change replaces it, a dismissed card drops it.
  useEffect(() => {
    const live = new Set(state.jobs.map((j) => j.id));
    for (const [id, t] of timers.current) if (!live.has(id)) { clearTimeout(t.timer); timers.current.delete(id); }
    for (const job of state.jobs) {
      const prev = timers.current.get(job.id);
      if (prev?.state === job.state) continue;
      if (prev) clearTimeout(prev.timer);
      const ms = AUTO_DISMISS_MS[job.state];
      if (ms === null) { timers.current.delete(job.id); continue; }
      timers.current.set(job.id, { state: job.state, timer: setTimeout(() => dismiss(job.id), ms) });
    }
  }, [state.jobs, dismiss]);
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t.timer)), []);

  const open = useCallback((id: string, startSec?: number) => {
    window.player.openJobResult(id, startSec).then(() => dismiss(id), (e) => notify("error", friendlyError(e)));
  }, [dismiss, notify]);

  return {
    jobs: state.jobs, dismiss,
    cancel: useCallback((id: string) => window.player.cancelJob(id), []),
    open,
    reveal: useCallback((id: string) => window.player.revealJobResult(id), []),
  };
}
