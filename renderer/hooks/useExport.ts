import type { FeatureCommand, FeatureDeps } from "./featureTypes";

/** Stub for the Export command: the feature team replaces the body, keeping this signature. */
export function useExport(deps: FeatureDeps): FeatureCommand {
  const { notify } = deps;
  return { run: () => notify("error", "Export is coming soon"), overlay: null };
}
