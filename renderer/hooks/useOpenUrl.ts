import { createElement, useCallback, useState } from "react";
import { OpenUrlDialog } from "../components/OpenUrlDialog";
import type { FeatureCommand, FeatureDeps } from "./featureTypes";

/** Open URL: a dialog that hands the URL to main, which downloads it as a job. */
export function useOpenUrl(_deps: FeatureDeps): FeatureCommand {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const submit = useCallback(async (url: string) => {
    await window.player.downloadUrl(url);
    setOpen(false);
  }, []);
  return {
    run: () => setOpen(true),
    overlay: open ? createElement(OpenUrlDialog, { key: "open-url", onSubmit: submit, onClose: close }) : null,
  };
}
