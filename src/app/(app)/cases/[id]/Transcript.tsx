"use client";

import { useState } from "react";
import type { TranscriptTurn } from "@/lib/types";

export function Transcript({ turns }: { turns: TranscriptTurn[] }) {
  const [open, setOpen] = useState(false);

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[24px] text-[var(--ink)]">Transcript</h2>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="whitespace-nowrap text-[13px] font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
        >
          {open ? "Collapse" : "Expand"}
        </button>
      </div>
      {open ? (
        <div className="flex flex-col gap-3.5 rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] px-6 py-[22px] [box-shadow:var(--sh)]">
          {turns.map((turn, i) =>
            turn.speaker === "interviewer" ? (
              <div
                key={i}
                className="rounded-[var(--rs)] bg-[var(--accent-50)] px-3.5 py-3"
              >
                <div className="mb-[3px] text-[11.5px] font-bold uppercase tracking-[0.06em] text-[var(--accent)]">
                  Interviewer
                </div>
                <p className="whitespace-pre-line text-[14.5px] leading-[1.65] text-[var(--ink)]">
                  {turn.text}
                </p>
              </div>
            ) : (
              <div key={i} className="px-3.5 py-1">
                <div className="mb-[3px] text-[11.5px] font-bold uppercase tracking-[0.06em] text-[var(--muted)]">
                  Candidate
                </div>
                <p className="whitespace-pre-line text-[14.5px] leading-[1.65] text-[var(--ink)]">
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
          className="w-full rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] px-6 py-4 text-left text-[13.5px] font-semibold text-[var(--muted)] transition-colors [box-shadow:var(--sh)] hover:bg-[var(--thead)]"
        >
          {turns.length} {turns.length === 1 ? "turn" : "turns"} · click to
          expand
        </button>
      )}
    </section>
  );
}
