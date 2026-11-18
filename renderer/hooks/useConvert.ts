import type { FeatureCommand, FeatureDeps } from "./featureTypes";

/** Stub for the Convert command: the feature team replaces the body, keeping this signature. */
export function useConvert(deps: FeatureDeps): FeatureCommand {
  const { notify } = deps;
  return { run: () => notify("error", "Convert is coming soon"), overlay: null };
}
