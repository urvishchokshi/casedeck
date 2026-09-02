import type { HTMLAttributes } from "react";

type PillProps = HTMLAttributes<HTMLSpanElement>;

export function Pill({ className = "", ...props }: PillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-accent-soft)] px-2.5 py-0.5 text-[length:var(--font-size-xs)] font-medium text-[var(--color-text-muted)] ${className}`}
      {...props}
    />
  );
}
