import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] p-[18px] [box-shadow:var(--sh)] ${className}`}
      {...props}
    />
  );
}
