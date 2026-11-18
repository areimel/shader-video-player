import { useCallback, useState } from "react";
import { ExportDialog } from "../components/ExportDialog";
import type { FeatureCommand, FeatureDeps } from "./featureTypes";

/** "Export with effect…": opens the dialog; the save dialog and the job itself live in the main process. */
export function useExport(deps: FeatureDeps): FeatureCommand {
  const [open, setOpen] = useState(false);
  const run = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  return { run, overlay: open ? <ExportDialog fx={deps.fx} onClose={close} /> : null };
}
