import type { FeatureCommand, FeatureDeps } from "./featureTypes";

/** Stub for the Open URL command: the feature team replaces the body, keeping this signature. */
export function useOpenUrl(deps: FeatureDeps): FeatureCommand {
  const { notify } = deps;
  return { run: () => notify("error", "Open URL is coming soon"), overlay: null };
}
