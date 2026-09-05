"use client";

import { useState } from "react";
import type { TranscriptTurn } from "@/lib/types";

export function Transcript({ turns }: { turns: TranscriptTurn[] }) {
  const [open, setOpen] = useState(true);

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-3 px-0.5">
        <h2 className="text-[19px] tracking-[-0.015em]">Transcript</h2>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="h-8 whitespace-nowrap rounded-[9px] border border-[var(--line-ctl)] bg-[var(--card)] px-[13px] text-[12.5px] font-semibold text-[var(--accent)] transition-[color,background-color,border-color,transform] active:scale-[0.97] hover:border-[var(--accent)]"
        >
          {open ? "Collapse" : "Expand"}
        </button>
      </div>
      {open ? (
        <div className="cd-fade-in flex flex-col gap-1.5 rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] px-[22px] py-5 [box-shadow:var(--sh)] max-desk:px-4">
          {turns.map((turn, i) =>
            turn.speaker === "interviewer" ? (
              <div
                key={i}
                className="rounded-[14px] bg-[var(--turn)] px-4 py-3.5"
              >
                <div className="mb-[7px] text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--accent)]">
                  Interviewer
                </div>
                <p className="whitespace-pre-line text-[15px] leading-[1.6] text-[var(--ink)] [text-wrap:pretty]">
                  {turn.text}
                </p>
              </div>
            ) : (
              <div key={i} className="px-4 py-2.5">
                <div className="mb-[7px] text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--muted-2)]">
                  Candidate
                </div>
                <p className="whitespace-pre-line text-[15px] leading-[1.6] text-[var(--ink)] [text-wrap:pretty]">
                  {turn.text}
                </p>
              </div>
            )
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="cd-fade-in w-full rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] px-6 py-4 text-left text-[13.5px] font-semibold text-[var(--muted)] transition-colors [box-shadow:var(--sh)] hover:bg-[var(--row-hover)]"
        >
          {turns.length} {turns.length === 1 ? "turn" : "turns"} · click to
          expand
        </button>
      )}
    </section>
  );
}
