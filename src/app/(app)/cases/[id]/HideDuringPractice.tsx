"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PRACTICE_START_EVENT } from "@/lib/practice-live/protocol";

/**
 * Wraps a server-rendered section of /cases/[id] that gives the answer away
 * (the Solution pages) so it folds away when a voice practice session starts
 * — same event the Transcript listens to. One click shows it again; it stays
 * shown after that. The collapsed state mirrors the Transcript's.
 */
export function HideDuringPractice({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const hide = () => setHidden(true);
    window.addEventListener(PRACTICE_START_EVENT, hide);
    return () => window.removeEventListener(PRACTICE_START_EVENT, hide);
  }, []);

  if (!hidden) return <>{children}</>;

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-3 px-0.5">
        <h2 className="text-[19px] tracking-[-0.015em]">{label}</h2>
        <button
          type="button"
          onClick={() => setHidden(false)}
          className="h-8 whitespace-nowrap rounded-[9px] border border-[var(--line-ctl)] bg-[var(--card)] px-[13px] text-[12.5px] font-semibold text-[var(--accent)] transition-[color,background-color,border-color,transform] active:scale-[0.97] hover:border-[var(--accent)]"
        >
          Show
        </button>
      </div>
      <button
        type="button"
        onClick={() => setHidden(false)}
        className="cd-fade-in w-full rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] px-6 py-4 text-left text-[13.5px] font-semibold text-[var(--muted)] transition-colors [box-shadow:var(--sh)] hover:bg-[var(--row-hover)] max-desk:px-4"
      >
        Hidden while you practise · click to show
      </button>
    </section>
  );
}
