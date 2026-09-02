"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleProps {
  title: string;
  defaultOpen?: boolean;
  /** When provided, the component is controlled (used for "Expand all"). */
  open?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}

export function Collapsible({
  title,
  defaultOpen = false,
  open,
  onToggle,
  children,
}: CollapsibleProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;

  const handleClick = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalOpen((prev) => !prev);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-3 px-[18px] py-3.5 text-left text-[15.5px] font-semibold tracking-[-0.01em] text-[var(--ink)] transition-colors hover:bg-[var(--thead)]"
      >
        <span className="flex-1">{title}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[var(--muted)] transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div className="px-[18px] pb-[18px] pt-0.5 text-[14.5px] leading-[1.65] text-[var(--muted)]">
          {children}
        </div>
      )}
    </div>
  );
}
