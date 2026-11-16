import { hint } from "../../shared/commands";
import { IS_MAC } from "../utils/platform";
import { IconButton } from "./common/IconButton";

interface Props {
  visible: boolean;
  name: string;
  /** Position in a multi-item queue, e.g. 2 of 5; null for a single file. */
  position: { index: number; total: number } | null;
  onBack: () => void;
}

/** Back button, file name and queue position; hides together with the bottom controls. */
export function TopBar({ visible, name, position, onBack }: Props) {
  return (
    <div className={`topbar ${visible ? "" : "is-hidden"}`} onDoubleClick={(e) => e.stopPropagation()}>
      <IconButton icon="back" label={hint("close", IS_MAC)} onClick={onBack} />
      <span className="topbar-name" title={name}>{name}</span>
      {position && <span className="topbar-pos">{position.index + 1} of {position.total}</span>}
    </div>
  );
}
