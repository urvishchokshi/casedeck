"use client";

import { useState } from "react";
import Link from "next/link";
import { OutcomePill } from "@/components/OutcomePill";
import type { CaseOutcome, DifficultyLevel } from "@/lib/types";

/** Display-ready row prepared by the server component. */
export interface CaseTableRow {
  id: string;
  title: string;
  /** Shortened casebook name, e.g. "IIM-Ahmedabad 2025–26". */
  book: string;
  company: string | null;
  industry: string | null;
  /** case_types joined for display. */
  type: string;
  difficulty: DifficultyLevel | null;
  /** "4.2" or null (rendered as "New"). */
  rating: string | null;
  outcome: CaseOutcome | null;
}

const PAGE_SIZE = 20;

const DIFFICULTY_WIDTH: Record<DifficultyLevel, string> = {
  Easy: "33%",
  Medium: "66%",
  Hard: "100%",
};

const gridCols =
  "desk:grid desk:min-w-[900px] desk:grid-cols-[minmax(0,1.6fr)_minmax(0,.8fr)_minmax(0,.95fr)_minmax(0,.85fr)_124px_76px_100px] desk:items-center desk:gap-4";

const cellText =
  "text-[13px] text-[var(--slate)] desk:truncate max-desk:flex max-desk:items-baseline max-desk:gap-2";

const mobileLabel =
  "hidden text-[11px] font-semibold text-[var(--faint)] max-desk:inline max-desk:flex-none";

function Dash() {
  return <span className="text-[var(--dash)]">—</span>;
}

export function CaseTable({ rows }: { rows: CaseTableRow[] }) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const shown = rows.slice(0, visible);
  const allShown = shown.length >= rows.length;

  return (
    <>
      <div className="overflow-x-auto rounded-[15px]">
        {/* Header (desktop only) */}
        <div
          className={`hidden rounded-[11px] bg-[var(--thead)] px-4 py-[11px] text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--muted-2)] ${gridCols}`}
        >
          <div>Case</div>
          <div>Company</div>
          <div>Industry</div>
          <div>Type</div>
          <div>Difficulty</div>
          <div>Rating</div>
          <div className="text-right">Status</div>
        </div>

        {shown.map((r) => (
          <Link
            key={r.id}
            href={`/cases/${r.id}`}
            className={`block border-b border-[var(--line-row)] px-4 py-[13px] text-[var(--ink)] transition-colors hover:bg-[var(--row-hover)] max-desk:flex max-desk:flex-col max-desk:gap-1.5 ${gridCols}`}
          >
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold tracking-[-0.005em]">
                {r.title}
              </div>
              <div className="mt-[3px] truncate text-[12px] text-[var(--muted-2)]">
                {r.book}
              </div>
            </div>

            <div className={cellText}>
              <span className={mobileLabel}>Company</span>
              {r.company ?? <Dash />}
            </div>

            <div className={cellText}>
              <span className={mobileLabel}>Industry</span>
              {r.industry ?? <Dash />}
            </div>

            <div className={cellText}>
              <span className={mobileLabel}>Type</span>
              {r.type || <Dash />}
            </div>

            <div className="flex items-center gap-2">
              <span className={mobileLabel}>Difficulty</span>
              {r.difficulty ? (
                <>
                  <span className="h-1 w-[34px] flex-none overflow-hidden rounded-[3px] bg-[var(--bar-track-sm)]">
                    <span
                      className="block h-1 rounded-[3px] bg-[var(--accent)]"
                      style={{ width: DIFFICULTY_WIDTH[r.difficulty] }}
                    />
                  </span>
                  <span className="text-[12.5px] text-[var(--muted)]">
                    {r.difficulty}
                  </span>
                </>
              ) : (
                <Dash />
              )}
            </div>

            <div className="text-[12.5px] text-[var(--muted-2)] max-desk:flex max-desk:items-baseline max-desk:gap-2">
              <span className={mobileLabel}>Rating</span>
              {r.rating ?? "New"}
            </div>

            <div className="flex items-center desk:justify-end">
              {r.outcome ? <OutcomePill outcome={r.outcome} /> : <Dash />}
            </div>
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <span className="text-[12px] text-[var(--muted-2)]">
          Showing 1–{shown.length} of {rows.length}
        </span>
        {!allShown && (
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="h-[34px] whitespace-nowrap rounded-[var(--rs)] border border-[var(--line-ctl)] bg-[var(--card)] px-4 text-[12.5px] font-semibold text-[var(--slate)] transition-colors hover:border-[var(--line-hover)]"
          >
            Load more
          </button>
        )}
      </div>
    </>
  );
}
