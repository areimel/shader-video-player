import { useRef, type HTMLAttributes, type ReactNode } from "react";
import { useDismiss } from "../../hooks/useDismiss";

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** Called on Escape (and outside click if `dismissOutside`). Omit for a panel the parent controls. */
  onDismiss?: () => void;
  dismissOutside?: boolean;
}

/** Floating shell shared by the info, effects and queue panels. Position it via className. */
export function Panel({ onDismiss, dismissOutside = false, className = "", ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, () => onDismiss?.(), { enabled: !!onDismiss, outside: dismissOutside });
  return <div ref={ref} className={`panel ${className}`.trim()} {...rest} />;
}

export function PanelHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="panel-head">
      <strong>{title}</strong>
      {children}
    </div>
  );
}
