import { formatKey } from "../../../shared/commands";
import { IS_MAC } from "../../utils/platform";

/** Key hint from a KeyboardEvent.key or Electron accelerator, e.g. `<Kbd k="CmdOrCtrl+O" />`. */
export function Kbd({ k }: { k: string }) {
  return <kbd>{formatKey(k, IS_MAC)}</kbd>;
}
