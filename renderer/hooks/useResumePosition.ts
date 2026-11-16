import { useEffect, useRef } from "react";
import type { PlaybackPlan } from "../types/player";
import { savePosition } from "../utils/storage";

/** Saves the playhead every few seconds so the file resumes where it stopped. */
export function useResumePosition(plan: PlaybackPlan | null, time: number): void {
  // `time` still holds the previous file's playhead right after a plan change; save only once it has moved.
  const base = useRef<{ plan: PlaybackPlan | null; stale: number }>({ plan, stale: time });
  useEffect(() => {
    const b = base.current;
    if (b.plan !== plan) { base.current = { plan, stale: time }; return; }
    if (plan && time > 0 && time !== b.stale) savePosition(plan.info, time);
  }, [plan, Math.floor(time / 3)]);
}
