"use client";

import { useState } from "react";
import { Collapsible } from "@/components/ui/Collapsible";

export interface TranscriptRow {
  heading: string;
  content: string;
}

export function Transcript({ rows }: { rows: TranscriptRow[] }) {
  const [openRows, setOpenRows] = useState<boolean[]>(() =>
    rows.map((_, i) => i === 0)
  );
  const allOpen = openRows.every(Boolean);

  const toggleRow = (index: number) =>
    setOpenRows((prev) => prev.map((open, i) => (i === index ? !open : open)));

  const toggleAll = () => setOpenRows(rows.map(() => !allOpen));

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[24px] text-[var(--ink)]">Transcript</h2>
        <button
          type="button"
          onClick={toggleAll}
          className="whitespace-nowrap text-[13px] font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
        >
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>
      <div className="divide-y divide-[var(--line-soft)] overflow-hidden rounded-[var(--r)] border border-[var(--line)] bg-[var(--card)] [box-shadow:var(--sh)]">
        {rows.map((row, i) => (
          <Collapsible
            key={row.heading}
            title={row.heading}
            open={openRows[i]}
            onToggle={() => toggleRow(i)}
          >
            {row.content}
          </Collapsible>
        ))}
      </div>
    </section>
  );
}
