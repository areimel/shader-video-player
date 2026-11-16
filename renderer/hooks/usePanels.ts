import { useCallback, useState } from "react";

/** The two mutually exclusive side panels (file info, effects). */
export function usePanels() {
  const [showInfo, setShowInfo] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const closeInfo = useCallback(() => setShowInfo(false), []);
  const closeEffects = useCallback(() => setShowEffects(false), []);
  const toggleInfo = useCallback(() => { setShowInfo((v) => !v); setShowEffects(false); }, []);
  const toggleEffects = useCallback(() => { setShowEffects((v) => !v); setShowInfo(false); }, []);
  const closeAll = useCallback(() => { setShowInfo(false); setShowEffects(false); }, []);
  return { showInfo, showEffects, closeInfo, closeEffects, toggleInfo, toggleEffects, closeAll };
}

export type Panels = ReturnType<typeof usePanels>;
