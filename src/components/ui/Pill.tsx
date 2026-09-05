import type { HTMLAttributes } from "react";

type PillTone = "chip" | "accent" | "rating" | "done" | "revisit";

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
}

const toneClasses: Record<PillTone, string> = {
  chip: "bg-[var(--pill)] text-[var(--slate)]",
  accent: "bg-[var(--accent-tint)] text-[var(--accent)]",
  rating: "bg-[var(--revisit-bg)] text-[var(--revisit-fg)]",
  done: "bg-[var(--done-bg)] text-[var(--done-fg)]",
  revisit: "bg-[var(--revisit-bg)] text-[var(--revisit-fg)]",
};

export function Pill({ tone = "chip", className = "", ...props }: PillProps) {
  return (
    <span
      className={`inline-flex items-center gap-[6px] whitespace-nowrap rounded-[9px] px-[11px] py-[6px] text-[12px] font-semibold ${toneClasses[tone]} ${className}`}
      {...props}
    />
  );
}
