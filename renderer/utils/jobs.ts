import type { JobSnapshot, JobState } from "../../shared/jobs";

/** Jobs the card stack shows, oldest first, minus the ones the user (or a timer) dismissed. */
export interface JobsState {
  jobs: JobSnapshot[];
  /** Ids that were dismissed: a late update or a reload's list must not bring their card back. */
  dismissed: string[];
}

export type JobsAction =
  | { type: "upsert"; job: JobSnapshot }
  | { type: "load"; jobs: JobSnapshot[] }
  | { type: "dismiss"; id: string };

export const EMPTY_JOBS: JobsState = { jobs: [], dismissed: [] };

const MAX_DISMISSED = 100;

export function jobsReducer(state: JobsState, a: JobsAction): JobsState {
  switch (a.type) {
    case "upsert": {
      if (state.dismissed.includes(a.job.id)) return state;
      const at = state.jobs.findIndex((j) => j.id === a.job.id);
      const jobs = at < 0 ? [...state.jobs, a.job] : state.jobs.map((j, i) => (i === at ? a.job : j));
      return { ...state, jobs };
    }
    case "load": {
      // After a reload only the running jobs are worth a card; finished ones were already seen. The list can
      // arrive after a newer push, so a job already known keeps its (newer) state.
      let next = state;
      for (const job of a.jobs) {
        if (job.state === "running" && !state.jobs.some((j) => j.id === job.id)) next = jobsReducer(next, { type: "upsert", job });
      }
      return next;
    }
    case "dismiss": {
      if (!state.jobs.some((j) => j.id === a.id)) return state;
      return {
        jobs: state.jobs.filter((j) => j.id !== a.id),
        dismissed: [...state.dismissed, a.id].slice(-MAX_DISMISSED),
      };
    }
  }
}

/** How long a card in this state stays before it dismisses itself; null = until the user dismisses it. */
export const AUTO_DISMISS_MS: Record<JobState, number | null> = {
  running: null,
  done: 8000,
  failed: null,
  cancelled: 3000,
};

/** "about 2 min left", or "" when the estimate is unknown. */
export function formatEta(etaSec: number | null): string {
  if (etaSec === null || !Number.isFinite(etaSec) || etaSec < 0) return "";
  if (etaSec < 10) return "a few seconds left";
  if (etaSec < 60) return `about ${Math.round(etaSec / 5) * 5} sec left`;
  if (etaSec < 90) return "about 1 min left";
  const min = Math.round(etaSec / 60);
  if (min < 60) return `about ${min} min left`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `about ${h} h ${m} min left` : `about ${h} h left`;
}
