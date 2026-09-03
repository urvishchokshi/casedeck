import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

// Exported so ButtonLink can render an anchor with identical styling.
export const buttonBaseClasses =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--rs)] px-[15px] text-[13.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)]",
  secondary:
    "border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] hover:bg-[var(--thead)]",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${buttonBaseClasses} ${buttonVariantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
