import { useCallback, useEffect, useRef } from "react";
import { friendlyError } from "../utils/format";
import type { FeatureCommand, FeatureDeps } from "./featureTypes";

/** Convert for smooth playback: only for a file that plays through the live transcode. */
export function useConvert(deps: FeatureDeps): FeatureCommand {
  const { notify, plan } = deps;
  const hinted = useRef(new Set<string>());
  const planRef = useRef(plan);
  planRef.current = plan;

  const run = useCallback(() => {
    const p = planRef.current;
    if (!p) return notify("error", "Open a video first");
    if (p.mode !== "transcode") return notify("info", "This file already plays natively");
    window.player.convertCurrent(p.audioOrdinal).then(
      () => undefined, (e) => notify("error", friendlyError(e)),
    );
  }, [notify]);

  // One hint per path per session, when a transcode plan opens.
  const path = plan?.info.path;
  const transcoding = plan?.mode === "transcode";
  useEffect(() => {
    if (!path || !transcoding || hinted.current.has(path)) return;
    hinted.current.add(path);
    notify("info", "Seeking may stutter", { label: "Convert for smooth playback", run });
  }, [path, transcoding, notify, run]);

  return { run, overlay: null };
}
