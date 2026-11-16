import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "quiet" | "link";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = "primary", className = "", type = "button", ...rest }: Props) {
  return <button type={type} className={`btn btn-${variant} ${className}`.trim()} {...rest} />;
}
