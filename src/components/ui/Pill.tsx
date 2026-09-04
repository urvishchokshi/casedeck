import type { HTMLAttributes } from "react";

type PillTone = "chip" | "accent" | "amber";

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
}

const toneClasses: Record<PillTone, string> = {
  chip: "bg-[var(--chip)] text-[var(--ink)]",
  accent: "bg-[var(--accent-50)] text-[var(--accent)]",
  amber: "bg-[var(--amber-50)] text-[var(--amber)]",
};

export function Pill({ tone = "chip", className = "", ...props }: PillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-[11px] py-1 text-[12px] font-semibold ${toneClasses[tone]} ${className}`}
      {...props}
    />
  );
}
