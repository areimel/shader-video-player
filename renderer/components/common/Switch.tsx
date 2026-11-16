interface Props {
  checked: boolean;
  label: string;
  onChange: (on: boolean) => void;
}

export function Switch({ checked, label, onChange }: Props) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} title={label}
      className={`switch ${checked ? "is-on" : ""}`} onClick={() => onChange(!checked)}>
      <span className="switch-knob" />
    </button>
  );
}
