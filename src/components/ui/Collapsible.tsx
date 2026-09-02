"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function Collapsible({
  title,
  defaultOpen = false,
  children,
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-4 text-left text-[length:var(--font-size-base)] font-semibold text-[var(--color-text)]"
      >
        {title}
        <ChevronDown
          size={18}
          className={`text-[var(--color-text-muted)] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="border-t border-[var(--color-border)] px-5 py-4 text-[length:var(--font-size-sm)] leading-relaxed text-[var(--color-text-muted)]">
          {children}
        </div>
      )}
    </div>
  );
}
