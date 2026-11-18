import type { ReactNode } from "react";
import type { FeatureCommand, FeatureDeps } from "./featureTypes";
import { useConvert } from "./useConvert";
import { useExport } from "./useExport";
import { useOpenUrl } from "./useOpenUrl";

export type { FeatureCommand, FeatureDeps } from "./featureTypes";

export interface FeatureCommands {
  commands: { openUrl: () => void; convert: () => void; exportVideo: () => void };
  /** Dialogs to mount once, next to the other overlays. */
  overlays: ReactNode[];
}

/** The three File-menu features behind one deps object, so each can grow without touching App.tsx. */
export function useFeatureCommands(deps: FeatureDeps): FeatureCommands {
  const openUrl: FeatureCommand = useOpenUrl(deps);
  const convert: FeatureCommand = useConvert(deps);
  const exportVideo: FeatureCommand = useExport(deps);
  return {
    commands: { openUrl: openUrl.run, convert: convert.run, exportVideo: exportVideo.run },
    overlays: [openUrl.overlay, convert.overlay, exportVideo.overlay],
  };
}
