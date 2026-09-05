import type { CaseOutcome } from "@/lib/types";

/**
 * Single source of truth for how the two outcomes render: pill label + Pill
 * tone + status-dot token (case detail, library table, mobile cards) and the
 * long option label used by the log dialog's segmented control.
 */
export const OUTCOME_META: Record<
  CaseOutcome,
  { pill: string; tone: "done" | "revisit"; dot: string; option: string }
> = {
  done: { pill: "Done", tone: "done", dot: "var(--done-dot)", option: "Done" },
  revisit: {
    pill: "Revisit",
    tone: "revisit",
    dot: "var(--revisit-dot)",
    option: "Revisit before placement",
  },
};

export const OUTCOME_ORDER: CaseOutcome[] = ["done", "revisit"];
