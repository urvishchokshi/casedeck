import type { HTMLAttributes } from "react";

type PillTone = "chip" | "accent" | "amber" | "amber-outline";

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
}

const toneClasses: Record<PillTone, string> = {
  chip: "bg-[var(--chip)] text-[var(--ink)]",
  accent: "bg-[var(--accent-50)] text-[var(--accent)]",
  amber: "bg-[var(--amber-50)] text-[var(--amber)]",
  // Inset ring instead of a border keeps the pill the same height as the
  // filled tones it sits beside in the library Status column.
  "amber-outline": "text-[var(--amber)] [box-shadow:inset_0_0_0_1px_var(--amber)]",
};

export function Pill({ tone = "chip", className = "", ...props }: PillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-[11px] py-1 text-[12px] font-semibold ${toneClasses[tone]} ${className}`}
      {...props}
    />
  );
}
