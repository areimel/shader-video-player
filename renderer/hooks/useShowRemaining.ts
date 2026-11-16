import { useCallback, useState } from "react";
import { loadShowRemaining, saveShowRemaining } from "../utils/storage";

/** Persisted "show remaining time" preference: [value, toggle]. */
export function useShowRemaining(): [boolean, () => void] {
  const [on, setOn] = useState(loadShowRemaining);
  const toggle = useCallback(() => setOn((v) => { saveShowRemaining(!v); return !v; }), []);
  return [on, toggle];
}
